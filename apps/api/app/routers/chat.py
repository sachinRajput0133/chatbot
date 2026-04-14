import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.conversation import WebConversation, WebMessage
from app.schemas.chat import ChatRequest, ChatResponse, ConversationSummary
from app.services.chat_service import handle_chat

router = APIRouter(tags=["chat"])


class ContactRequest(BaseModel):
    visitor_id: str
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    page_url: str | None = None


class ContactResponse(BaseModel):
    conversation_id: uuid.UUID


@router.post("/api/chat/{bot_id}/contact", response_model=ContactResponse)
async def save_visitor_contact(
    bot_id: uuid.UUID,
    data: ContactRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — called by the pre-chat lead form in widget.js.
    Creates (or updates) a conversation with the visitor's contact details.
    """
    # Verify bot exists
    result = await db.execute(
        select(Tenant).where(Tenant.bot_id == bot_id, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Find latest existing conversation for this visitor, or create one
    result = await db.execute(
        select(WebConversation)
        .where(
            WebConversation.tenant_id == tenant.id,
            WebConversation.visitor_id == data.visitor_id,
        )
        .order_by(WebConversation.started_at.desc())
        .limit(1)
    )
    conv = result.scalar_one_or_none()

    if conv is None:
        conv = WebConversation(
            tenant_id=tenant.id,
            visitor_id=data.visitor_id,
            page_url=data.page_url,
        )
        db.add(conv)

    if data.name:
        conv.visitor_name = data.name
    if data.email:
        conv.visitor_email = data.email
    if data.phone:
        conv.visitor_phone = data.phone
    if data.address:
        conv.visitor_address = data.address

    await db.commit()
    await db.refresh(conv)
    return ContactResponse(conversation_id=conv.id)


class HistoryMessage(BaseModel):
    role: str
    content: str
    created_at: datetime


@router.get("/api/chat/{bot_id}/history")
async def get_chat_history(
    bot_id: uuid.UUID,
    visitor_id: str = Query(...),
    conversation_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
) -> list[HistoryMessage]:
    """
    Public endpoint — returns messages for a specific visitor's conversation.
    Ownership verified by matching visitor_id + conversation_id + bot_id.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.bot_id == bot_id, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Bot not found")

    result = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
            WebConversation.visitor_id == visitor_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(WebMessage)
        .where(WebMessage.conversation_id == conv.id)
        .order_by(WebMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        HistoryMessage(role=m.role.value, content=m.content, created_at=m.created_at)
        for m in messages
    ]


@router.post("/api/chat/{bot_id}", response_model=ChatResponse)
async def chat(
    bot_id: uuid.UUID,
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — called by widget.js on every message.
    CORS is open (any origin) — configured in main.py.
    """
    reply, message_id, conversation_id = await handle_chat(
        bot_id=bot_id,
        message=data.message,
        visitor_id=data.visitor_id,
        conversation_id=data.conversation_id,
        page_url=data.page_url,
        db=db,
        user_info=data.user_info,
    )
    return ChatResponse(reply=reply, message_id=message_id, conversation_id=conversation_id)


@router.get("/api/chat/{bot_id}/conversations", response_model=list[ConversationSummary])
async def get_visitor_conversations(
    bot_id: uuid.UUID,
    visitor_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — returns recent conversations for a specific visitor.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.bot_id == bot_id, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Fetch recently updated conversations (max 20)
    result = await db.execute(
        select(WebConversation)
        .where(
            WebConversation.tenant_id == tenant.id,
            WebConversation.visitor_id == visitor_id,
        )
        .order_by(WebConversation.last_message_at.desc())
        .limit(20)
    )
    conversations = list(result.scalars().all())

    summaries = []
    for conv in conversations:
        # Get first message to use as title
        first_msg_res = await db.execute(
            select(WebMessage).where(WebMessage.conversation_id == conv.id).order_by(WebMessage.created_at.asc()).limit(1)
        )
        first_msg = first_msg_res.scalar_one_or_none()
        title = first_msg.content[:40] + "..." if first_msg and len(first_msg.content) > 40 else (first_msg.content if first_msg else "Chat with AI Agent")

        # Get latest message
        last_msg_res = await db.execute(
            select(WebMessage).where(WebMessage.conversation_id == conv.id).order_by(WebMessage.created_at.desc()).limit(1)
        )
        last_msg = last_msg_res.scalar_one_or_none()
        summary = last_msg.content[:60] + "..." if last_msg and len(last_msg.content) > 60 else (last_msg.content if last_msg else "")
        # Add basic role prefix if agent/bot
        if last_msg and last_msg.role != "user":
            summary = f"Agent: {summary}"
            
        summaries.append(
            ConversationSummary(
                id=conv.id,
                started_at=conv.started_at.isoformat(),
                last_message_at=conv.last_message_at.isoformat(),
                title=title,
                latest_message=summary
            )
        )

    return summaries
