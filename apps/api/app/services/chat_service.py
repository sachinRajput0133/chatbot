"""
RAG-powered chat service.
Provider priority: groq → anthropic → openai → gemini → grok
Embeddings: OpenAI if key set, otherwise falls back to keyword search.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from fastapi import HTTPException

from app.core.config import settings
from app.core.redis import get_conversation_history, append_conversation_message, publish_to_conversation, publish_to_tenant
from app.models.tenant import Tenant, Plan
from app.models.conversation import WebConversation, WebMessage, MessageRole
from app.models.widget import WidgetConfig
from app.schemas.chat import VisitorInfo
from app.services import email_service, lead_capture_service

logger = logging.getLogger(__name__)

AI_FAILURE_FALLBACK = (
    "Our AI assistant is temporarily unavailable. A human team member will "
    "follow up with you shortly — thank you for your patience!"
)

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

REPHRASE_PROMPT = """Given the conversation history and a new user message, rephrase the user message into a standalone search query for a knowledge base search.
If the message is already a standalone query, return it as is.
If it's an affirmative/negative (e.g. "yes", "ok", "sure") or follow-up, use the history to make it specific.
Output ONLY the rephrased query string, no other text."""


def _build_system_prompt(widget: "WidgetConfig | None", business_name: str) -> str:
    """Build system prompt from explicit override, brand voice fields, or default."""
    if widget and widget.system_prompt:
        return widget.system_prompt

    if widget and any([widget.what_we_do, widget.tone_of_voice, widget.target_audience,
                       widget.brand_values, widget.unique_selling_proposition,
                       widget.company_email, widget.company_phone, widget.business_hours]):
        lines = [f"You are a helpful assistant for {widget.bot_name} ({business_name})."]
        if widget.tone_of_voice:
            lines.append(f"Tone of voice: {widget.tone_of_voice}.")
        if widget.what_we_do:
            lines.append(f"What we do: {widget.what_we_do}.")
        if widget.target_audience:
            lines.append(f"Our target audience: {widget.target_audience}.")
        if widget.brand_values:
            lines.append(f"Our values: {widget.brand_values}.")
        if widget.unique_selling_proposition:
            lines.append(f"What makes us unique: {widget.unique_selling_proposition}.")
        contact_parts = []
        if widget.business_hours:
            contact_parts.append(f"Business hours: {widget.business_hours}")
        if widget.company_email:
            contact_parts.append(f"Email: {widget.company_email}")
        if widget.company_phone:
            contact_parts.append(f"Phone: {widget.company_phone}")
        if widget.company_address:
            contact_parts.append(f"Address: {widget.company_address}")
        if contact_parts:
            lines.append(". ".join(contact_parts) + ".")
        lines.append(
            "Answer questions based ONLY on the provided context. "
            "If the answer is not in the context, say \"I don't have that information — "
            f"please contact us{f' at {widget.company_email}' if widget.company_email else ' directly'}.\" "
            "Keep responses concise and friendly. Do not make up information."
        )
        return "\n".join(lines)

    return DEFAULT_SYSTEM_PROMPT.format(business_name=business_name)


# ── Provider detection ─────────────────────────────────────────────────────────

def _active_provider() -> str:
    """Return whichever provider has a key set. Priority: groq → anthropic → openai → gemini → grok"""
    if settings.GROQ_API_KEY:
        return "groq"
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.OPENAI_API_KEY:
        return "openai"
    if settings.GEMINI_API_KEY:
        return "gemini"
    if settings.GROK_API_KEY:
        return "grok"
    raise HTTPException(
        status_code=500,
        detail="No AI provider key configured. Add GROQ_API_KEY or ANTHROPIC_API_KEY to .env"
    )


async def _call_ai(messages: list[dict], system: str) -> tuple[str, int]:
    """Call the active AI provider. Returns (reply, tokens_used)."""
    provider = _active_provider()

    if provider == "groq":
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=1024,
            temperature=0.3,
        )
        reply = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0
        return reply, tokens

    if provider == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        reply = response.content[0].text
        tokens = response.usage.input_tokens + response.usage.output_tokens
        return reply, tokens

    if provider == "openai":
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0
        return reply, tokens

    if provider == "gemini":
        import asyncio
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = system + "\n\n" + "\n".join(f"{m['role']}: {m['content']}" for m in messages)
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text, 0

    if provider == "grok":
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.x.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.GROK_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "grok-3-mini",
                    "messages": [{"role": "system", "content": system}] + messages,
                    "max_tokens": 1024,
                    "temperature": 0,
                },
            )
            data = resp.json()
        return data["choices"][0]["message"]["content"], 0

    raise HTTPException(status_code=500, detail="No AI provider available")


async def _rephrase_query(history: list[dict], message: str) -> str:
    """Use AI to rephrase the latest message into a standalone search query if needed."""
    if len(message.split()) > 10:
        return message  # Probably detailed enough

    rephrase_messages = history + [{"role": "user", "content": message}]
    try:
        query, _ = await _call_ai(rephrase_messages, REPHRASE_PROMPT)
        return query.strip().strip('"')
    except Exception:
        return message  # Fallback to original


# ── Embeddings ─────────────────────────────────────────────────────────────────

async def _embed_query(query: str) -> list[float] | None:
    """Returns embedding vector or None if no OpenAI key (falls back to keyword search)."""
    if not settings.OPENAI_API_KEY:
        return None
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(model="text-embedding-3-small", input=query)
    return response.data[0].embedding


async def _retrieve_chunks(tenant_id: uuid.UUID, query: str, embedding: list[float] | None, db: AsyncSession) -> list[str]:
    if embedding:
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        result = await db.execute(
            text("""
                SELECT content FROM knowledge_chunks
                WHERE tenant_id = :tenant_id
                ORDER BY embedding <=> :embedding::vector
                LIMIT 5
            """),
            {"tenant_id": str(tenant_id), "embedding": embedding_str},
        )
    else:
        # Keyword search fallback when no OpenAI key
        words = [w for w in query.lower().split() if len(w) > 3]
        if not words:
            return []
        params: dict = {"tenant_id": str(tenant_id)}
        params.update({f"w{i}": f"%{w}%" for i, w in enumerate(words[:5])})
        result = await db.execute(
            text(f"""
                SELECT content FROM knowledge_chunks
                WHERE tenant_id = :tenant_id
                AND ({" OR ".join(f"LOWER(content) LIKE :w{i}" for i in range(len(words[:5])))})
                LIMIT 5
            """),
            params,
        )
    return [row[0] for row in result.fetchall()]


# ── Conversation helpers ───────────────────────────────────────────────────────

async def _get_or_create_conversation(
    tenant_id: uuid.UUID, visitor_id: str,
    conversation_id: uuid.UUID | None, page_url: str | None,
    db: AsyncSession,
    user_info: VisitorInfo | None = None,
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
            # Update identity fields if the user provided them and they changed
            if user_info:
                if user_info.name:
                    conv.visitor_name = user_info.name
                if user_info.email:
                    conv.visitor_email = user_info.email
                if user_info.phone:
                    conv.visitor_phone = user_info.phone
            return conv
    # New conversation — populate identity fields from user_info if present
    conv = WebConversation(
        tenant_id=tenant_id,
        visitor_id=visitor_id,
        page_url=page_url,
        visitor_name=user_info.name if user_info else None,
        visitor_email=user_info.email if user_info else None,
        visitor_phone=user_info.phone if user_info else None,
        external_user_id=user_info.user_id if user_info else None,
    )
    db.add(conv)
    await db.flush()
    return conv


# ── Main entry point ───────────────────────────────────────────────────────────

async def handle_chat(
    bot_id: uuid.UUID, message: str, visitor_id: str,
    conversation_id: uuid.UUID | None, page_url: str | None,
    db: AsyncSession,
    user_info: VisitorInfo | None = None,
) -> tuple[str, uuid.UUID]:

    result = await db.execute(select(Tenant).where(Tenant.bot_id == bot_id))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=404, detail="Bot not found")

    limit = PLAN_LIMITS.get(tenant.plan, 100)
    if tenant.message_count_month >= limit:
        raise HTTPException(status_code=429, detail="Monthly message limit reached. Please upgrade your plan.")

    result = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
    widget = result.scalar_one_or_none()
    system_prompt = _build_system_prompt(widget, tenant.business_name)

    # If user is identified, use a stable visitor_id based on their external user ID
    if user_info and user_info.user_id:
        visitor_id = f"usr_{user_info.user_id}"

    # Fetch/create conversation BEFORE building the lead collection prompt so we can
    # check which fields are already known and avoid asking for them again.
    conv = await _get_or_create_conversation(tenant.id, visitor_id, conversation_id, page_url, db, user_info)

    # Append lead collection instructions, skipping fields the visitor already provided.
    lead_config = await lead_capture_service.get_config(tenant.id, db)
    if lead_config:
        system_prompt += lead_capture_service.build_lead_collection_prompt(
            lead_config,
            known_name=conv.visitor_name,
            known_email=conv.visitor_email,
            known_phone=conv.visitor_phone,
            known_address=getattr(conv, "visitor_address", None),
        )

    # Extract contact info from the user's message and update conversation record
    if lead_config and lead_config.enabled:
        extracted = lead_capture_service.extract_contact_info(message)
        if extracted.get("name") and not conv.visitor_name:
            conv.visitor_name = extracted["name"]
        if extracted.get("email") and not conv.visitor_email:
            conv.visitor_email = extracted["email"]
        if extracted.get("phone") and not conv.visitor_phone:
            conv.visitor_phone = extracted["phone"]

    # ── User message ──
    user_msg_id = uuid.uuid4()
    db.add(WebMessage(id=user_msg_id, conversation_id=conv.id, role=MessageRole.user, content=message))
    await append_conversation_message(str(bot_id), visitor_id, "user", message)
    
    # Broadcast User message IMMEDIATELY so agents see it while AI is thinking
    from app.core.redis import publish_to_conversation, publish_to_tenant
    
    user_payload = {
        "id": str(user_msg_id), 
        "role": "user", 
        "content": message, 
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await publish_to_conversation(str(conv.id), user_payload)
    await publish_to_tenant(str(tenant.id), {
        "type": "new_message", 
        "conversation_id": str(conv.id), 
        "message": user_payload
    })

    # Commit the user message so it's in DB even if AI call fails
    await db.commit()

    # ── Human Agent Takeover ──
    # If a human is talking, skip the AI completely.
    if conv.mode == "human":
        return "__human_mode__", conv.id

    # ── AI Reply ──
    history = await get_conversation_history(str(bot_id), visitor_id)
    search_query = await _rephrase_query(list(history), message)
    
    embedding = await _embed_query(search_query)
    context_chunks = await _retrieve_chunks(tenant.id, search_query, embedding, db)

    messages = list(history) + [{"role": "user", "content": message}]
    context_text = "\n\n---\n\n".join(context_chunks) if context_chunks else "No relevant context found."
    full_system = f"{system_prompt}\n\n<context>\n{context_text}\n</context>"

    try:
        reply, tokens_used = await _call_ai(messages, full_system)
    except Exception as exc:
        logger.exception(f"[AI Escalation] Provider failed for conversation {conv.id}: {exc}")
        return await _escalate_to_human(
            tenant=tenant, conv=conv, visitor_message=message,
            error_detail=f"{type(exc).__name__}: {exc}"[:300], db=db,
        )

    ai_msg_id = uuid.uuid4()
    db.add(WebMessage(id=ai_msg_id, conversation_id=conv.id, role=MessageRole.assistant, content=reply, tokens_used=tokens_used))
    tenant.message_count_month += 1
    await db.commit()

    await append_conversation_message(str(bot_id), visitor_id, "assistant", reply)

    # Broadcast AI reply
    ai_payload = {
        "id": str(ai_msg_id),
        "role": "assistant",
        "content": reply,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await publish_to_conversation(str(conv.id), ai_payload)
    await publish_to_tenant(str(tenant.id), {
        "type": "new_message",
        "conversation_id": str(conv.id),
        "message": ai_payload
    })

    return reply, ai_msg_id, conv.id


async def _escalate_to_human(
    *, tenant: Tenant, conv: WebConversation, visitor_message: str,
    error_detail: str, db: AsyncSession,
) -> tuple[str, uuid.UUID, uuid.UUID]:
    """
    Called when the AI provider fails. Flips the conversation to human mode,
    stores a fallback reply, broadcasts to the dashboard, and fires email + Slack
    alerts to the tenant. The visitor sees a graceful "we'll follow up" message.
    """
    conv.mode = "human"

    fallback_msg_id = uuid.uuid4()
    db.add(WebMessage(
        id=fallback_msg_id, conversation_id=conv.id,
        role=MessageRole.assistant, content=AI_FAILURE_FALLBACK, tokens_used=0,
    ))
    await db.commit()

    await append_conversation_message(str(tenant.bot_id), conv.visitor_id, "assistant", AI_FAILURE_FALLBACK)

    fallback_payload = {
        "id": str(fallback_msg_id),
        "role": "assistant",
        "content": AI_FAILURE_FALLBACK,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await publish_to_conversation(str(conv.id), fallback_payload)
    await publish_to_tenant(str(tenant.id), {
        "type": "ai_escalation",
        "conversation_id": str(conv.id),
        "message": fallback_payload,
        "reason": error_detail,
    })

    # Fire-and-forget: notify the tenant so an agent can take over.
    # Run sync Resend + Slack calls in a worker thread so they don't block the reply.
    async def _notify() -> None:
        try:
            await asyncio.to_thread(
                email_service.send_ai_escalation,
                to=tenant.email,
                business_name=tenant.business_name,
                conversation_id=str(conv.id),
                visitor_name=conv.visitor_name,
                visitor_email=conv.visitor_email,
                visitor_message=visitor_message,
                error_detail=error_detail,
            )
            await asyncio.to_thread(
                email_service.notify_slack_escalation,
                business_name=tenant.business_name,
                conversation_id=str(conv.id),
                visitor_name=conv.visitor_name,
                visitor_email=conv.visitor_email,
                visitor_message=visitor_message,
                error_detail=error_detail,
            )
        except Exception as e:
            logger.warning(f"[AI Escalation] Notification failed: {e}")

    asyncio.create_task(_notify())

    return AI_FAILURE_FALLBACK, fallback_msg_id, conv.id
