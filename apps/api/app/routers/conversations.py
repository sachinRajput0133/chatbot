import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.conversation import WebConversation, WebMessage, MessageRole
from app.schemas.conversation import ConversationOut, MessageOut, MessagesPage, SetModeIn, AgentReplyIn
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


@router.get("/{conversation_id}/messages", response_model=MessagesPage)
async def get_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(30, ge=1, le=100),
    before: uuid.UUID | None = Query(None, description="Cursor: fetch messages older than this message ID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Cursor-based paginated messages.

    - First load: omit `before` → returns the **latest** `limit` messages.
    - Load older: pass `before=<next_cursor>` from previous response.
    - Response is always in **chronological order** (oldest → newest).
    - `has_more=true` means there are still older messages to load.
    """
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    # Verify conversation belongs to this tenant
    conv_result = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
    )
    if not conv_result.scalar_one_or_none():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Build query — fetch DESC so we get the freshest (or just-before-cursor) messages.
    # We fetch limit+1 to detect whether there are more older messages.
    query = (
        select(WebMessage)
        .where(WebMessage.conversation_id == conversation_id)
        .order_by(WebMessage.created_at.desc())
        .limit(limit + 1)
    )

    if before:
        # Find the created_at of the cursor message so we can use a timestamp boundary.
        # Using the UUID directly is simpler and avoids a subquery.
        cursor_result = await db.execute(
            select(WebMessage.created_at).where(WebMessage.id == before)
        )
        cursor_ts = cursor_result.scalar_one_or_none()
        if cursor_ts:
            query = (
                select(WebMessage)
                .where(
                    WebMessage.conversation_id == conversation_id,
                    WebMessage.created_at < cursor_ts,
                )
                .order_by(WebMessage.created_at.desc())
                .limit(limit + 1)
            )

    result = await db.execute(query)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]  # drop the extra sentinel row

    # Reverse back to chronological order (oldest → newest)
    rows.reverse()

    next_cursor = str(rows[0].id) if (has_more and rows) else None

    return MessagesPage(
        messages=rows,
        has_more=has_more,
        next_cursor=next_cursor,
    )


@router.patch("/{conversation_id}/mode", response_model=ConversationOut)
async def set_conversation_mode(
    conversation_id: uuid.UUID,
    payload: SetModeIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Toggle a conversation between AI and human mode."""
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

    if payload.mode not in ["ai", "human"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Mode must be 'ai' or 'human'")

    conv.mode = payload.mode
    await db.commit()
    await db.refresh(conv)
    
    count_result = await db.execute(select(func.count()).where(WebMessage.conversation_id == conv.id))
    msg_count = count_result.scalar() or 0
    out = ConversationOut.model_validate(conv)
    out.message_count = msg_count
    return out


@router.post("/{conversation_id}/agent-reply", response_model=MessageOut)
async def agent_reply(
    conversation_id: uuid.UUID,
    payload: AgentReplyIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save an agent reply and broadcast it to the widget via Redis pub/sub."""
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

    from datetime import datetime, timezone
    
    msg = WebMessage(
        conversation_id=conv.id,
        role=MessageRole.agent,
        content=payload.message,
    )
    db.add(msg)
    conv.last_message_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    # Broadcast to widget
    from app.core.redis import publish_to_conversation
    await publish_to_conversation(
        str(conv.id),
        {"role": "agent", "content": payload.message, "created_at": msg.created_at.isoformat()}
    )

    return msg
