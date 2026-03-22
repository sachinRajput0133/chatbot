"""
RAG-powered chat service.
Flow: embed query → pgvector similarity search → Claude response → store in DB
"""
import uuid
from datetime import datetime, timezone

import anthropic
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from fastapi import HTTPException

from app.core.config import settings
from app.core.redis import get_conversation_history, append_conversation_message
from app.models.tenant import Tenant, Plan
from app.models.knowledge import KnowledgeChunk
from app.models.conversation import WebConversation, WebMessage, MessageRole
from app.models.widget import WidgetConfig

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

PLAN_LIMITS = {
    Plan.free: 100,
    Plan.starter: 1000,
    Plan.growth: 10000,
    Plan.enterprise: 999999,
}

DEFAULT_SYSTEM_PROMPT = """You are a helpful customer support assistant for {business_name}.
Answer questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have that information. Please contact us directly."
Keep responses concise and friendly. Do not make up information."""


async def _embed_query(query: str) -> list[float]:
    response = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    )
    return response.data[0].embedding


async def _retrieve_chunks(tenant_id: uuid.UUID, embedding: list[float], db: AsyncSession, top_k: int = 5) -> list[str]:
    """Cosine similarity search using pgvector."""
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    result = await db.execute(
        text("""
            SELECT content
            FROM knowledge_chunks
            WHERE tenant_id = :tenant_id
            ORDER BY embedding <=> :embedding::vector
            LIMIT :top_k
        """),
        {"tenant_id": str(tenant_id), "embedding": embedding_str, "top_k": top_k},
    )
    return [row[0] for row in result.fetchall()]


async def _get_or_create_conversation(
    tenant_id: uuid.UUID,
    visitor_id: str,
    conversation_id: uuid.UUID | None,
    page_url: str | None,
    db: AsyncSession,
) -> WebConversation:
    if conversation_id:
        result = await db.execute(
            select(WebConversation).where(
                WebConversation.id == conversation_id,
                WebConversation.tenant_id == tenant_id,
            )
        )
        conv = result.scalar_one_or_none()
        if conv:
            conv.last_message_at = datetime.now(timezone.utc)
            return conv

    conv = WebConversation(
        tenant_id=tenant_id,
        visitor_id=visitor_id,
        page_url=page_url,
    )
    db.add(conv)
    await db.flush()
    return conv


async def handle_chat(
    bot_id: uuid.UUID,
    message: str,
    visitor_id: str,
    conversation_id: uuid.UUID | None,
    page_url: str | None,
    db: AsyncSession,
) -> tuple[str, uuid.UUID]:
    # Load tenant by bot_id
    result = await db.execute(select(Tenant).where(Tenant.bot_id == bot_id))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Enforce message quota
    limit = PLAN_LIMITS.get(tenant.plan, 100)
    if tenant.message_count_month >= limit:
        raise HTTPException(
            status_code=429,
            detail="Monthly message limit reached. Please upgrade your plan.",
        )

    # Get widget config for system prompt
    result = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
    widget = result.scalar_one_or_none()
    system_prompt = (widget.system_prompt if widget and widget.system_prompt else None) or \
        DEFAULT_SYSTEM_PROMPT.format(business_name=tenant.business_name)

    # Get or create conversation
    conv = await _get_or_create_conversation(tenant.id, visitor_id, conversation_id, page_url, db)

    # Embed and retrieve context
    embedding = await _embed_query(message)
    context_chunks = await _retrieve_chunks(tenant.id, embedding, db)

    # Build messages
    history = await get_conversation_history(str(bot_id), visitor_id)

    messages = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    context_text = "\n\n---\n\n".join(context_chunks) if context_chunks else "No relevant context found."

    full_system = f"{system_prompt}\n\n<context>\n{context_text}\n</context>"

    # Call Claude haiku (fast + cheap)
    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=full_system,
        messages=messages,
    )
    reply = response.content[0].text
    tokens_used = response.usage.input_tokens + response.usage.output_tokens

    # Persist messages to DB
    user_msg = WebMessage(conversation_id=conv.id, role=MessageRole.user, content=message)
    assistant_msg = WebMessage(
        conversation_id=conv.id,
        role=MessageRole.assistant,
        content=reply,
        tokens_used=tokens_used,
    )
    db.add(user_msg)
    db.add(assistant_msg)

    # Update tenant message count
    tenant.message_count_month += 1

    await db.commit()

    # Update Redis memory
    await append_conversation_message(str(bot_id), visitor_id, "user", message)
    await append_conversation_message(str(bot_id), visitor_id, "assistant", reply)

    return reply, conv.id
