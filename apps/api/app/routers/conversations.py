import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.conversation import WebConversation, WebMessage
from app.schemas.conversation import ConversationOut, MessageOut
from app.services import auth_service

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=list[ConversationOut])
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    offset = (page - 1) * limit

    result = await db.execute(
        select(WebConversation)
        .where(WebConversation.tenant_id == tenant.id)
        .order_by(WebConversation.last_message_at.desc())
        .offset(offset)
        .limit(limit)
    )
    conversations = result.scalars().all()

    out = []
    for conv in conversations:
        count_result = await db.execute(
            select(func.count()).where(WebMessage.conversation_id == conv.id)
        )
        msg_count = count_result.scalar() or 0
        out.append(ConversationOut(
            id=conv.id,
            visitor_id=conv.visitor_id,
            page_url=conv.page_url,
            started_at=conv.started_at,
            last_message_at=conv.last_message_at,
            message_count=msg_count,
            visitor_name=conv.visitor_name,
            visitor_email=conv.visitor_email,
            visitor_phone=conv.visitor_phone,
            external_user_id=conv.external_user_id,
        ))
    return out


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")
    count_result = await db.execute(
        select(func.count()).where(WebMessage.conversation_id == conv.id)
    )
    msg_count = count_result.scalar() or 0
    return ConversationOut(
        id=conv.id,
        visitor_id=conv.visitor_id,
        page_url=conv.page_url,
        started_at=conv.started_at,
        last_message_at=conv.last_message_at,
        message_count=msg_count,
        visitor_name=conv.visitor_name,
        visitor_email=conv.visitor_email,
        visitor_phone=conv.visitor_phone,
        external_user_id=conv.external_user_id,
    )


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(WebMessage)
        .join(WebConversation)
        .where(
            WebMessage.conversation_id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
        .order_by(WebMessage.created_at.asc())
    )
    return list(result.scalars().all())
