import csv
import io
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.conversation import WebConversation, WebMessage, MessageRole
from app.models.user import User
from app.schemas.conversation import ConversationOut, MessageOut, MessagesPage, SetModeIn, SetStatusIn, AgentReplyIn, UpdateTagsIn, InternalNoteIn, AssignConversationIn

ALLOWED_STATUSES = {"open", "pending", "resolved", "closed"}
from app.services import auth_service
from app.services import email_service

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=list[ConversationOut])
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    status: str | None = Query(
        None,
        description="Comma-separated status filter (open,pending,resolved,closed). "
                    "Omit to return all statuses.",
    ),
    assigned_to: str | None = Query(
        None,
        description="Filter by assignee. Accepts 'me', 'unassigned', or a user UUID.",
    ),
    sort: str | None = Query(
        None,
        description="Optional sort. Supported: 'lead_score_desc'. Defaults to last_message_at desc.",
    ),
    min_score: int | None = Query(
        None,
        ge=0,
        le=100,
        description="Filter to conversations with lead_score >= this value.",
    ),
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    offset = (page - 1) * limit

    stmt = (
        select(WebConversation)
        .where(WebConversation.tenant_id == tenant.id)
    )
    if min_score is not None:
        stmt = stmt.where(WebConversation.lead_score >= min_score)
    if status:
        wanted = {s.strip() for s in status.split(",") if s.strip()}
        invalid = wanted - ALLOWED_STATUSES
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid status values: {sorted(invalid)}")
        if wanted:
            stmt = stmt.where(WebConversation.status.in_(wanted))

    if assigned_to:
        if assigned_to == "unassigned":
            stmt = stmt.where(WebConversation.assigned_user_id.is_(None))
        elif assigned_to == "me":
            try:
                stmt = stmt.where(WebConversation.assigned_user_id == uuid.UUID(user_id))
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid current user id")
        else:
            try:
                target_uuid = uuid.UUID(assigned_to)
            except ValueError:
                raise HTTPException(status_code=400, detail="assigned_to must be 'me', 'unassigned', or a valid UUID")
            # Validate target is in tenant
            target_res = await db.execute(
                select(User.id).where(User.id == target_uuid, User.tenant_id == tenant.id)
            )
            if not target_res.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Assignee not found in tenant")
            stmt = stmt.where(WebConversation.assigned_user_id == target_uuid)

    if sort == "lead_score_desc":
        order_clause = (WebConversation.lead_score.desc(), WebConversation.last_message_at.desc())
    else:
        order_clause = (WebConversation.last_message_at.desc(),)
    result = await db.execute(
        stmt.order_by(*order_clause)
            .offset(offset)
            .limit(limit)
    )
    conversations = result.scalars().all()

    # Preload assigned user emails in one query
    assignee_ids = {c.assigned_user_id for c in conversations if c.assigned_user_id}
    assignee_email_map: dict[uuid.UUID, str] = {}
    if assignee_ids:
        a_res = await db.execute(
            select(User.id, User.email).where(User.id.in_(assignee_ids))
        )
        assignee_email_map = {row[0]: row[1] for row in a_res.all()}

    out = []
    for conv in conversations:
        count_result = await db.execute(select(func.count()).where(WebMessage.conversation_id == conv.id))
        msg_count = count_result.scalar() or 0
        
        last_read_at = conv.last_read_at
        unread_q = select(func.count()).where(WebMessage.conversation_id == conv.id)
        if last_read_at:
            unread_q = unread_q.where(WebMessage.created_at > last_read_at)
        
        unread_q = unread_q.where(WebMessage.role != MessageRole.agent)
        
        unread_result = await db.execute(unread_q)
        unread_count = unread_result.scalar() or 0

        out.append(ConversationOut(
            id=conv.id,
            visitor_id=conv.visitor_id,
            page_url=conv.page_url,
            started_at=conv.started_at,
            last_message_at=conv.last_message_at,
            message_count=msg_count,
            unread_count=unread_count,
            visitor_name=conv.visitor_name,
            visitor_email=conv.visitor_email,
            visitor_phone=conv.visitor_phone,
            visitor_address=conv.visitor_address,
            external_user_id=conv.external_user_id,
            mode=conv.mode,
            status=conv.status,
            resolved_at=conv.resolved_at,
            resolved_by_user_id=conv.resolved_by_user_id,
            last_read_at=conv.last_read_at,
            is_unread=unread_count > 0,
            tags=conv.tags,
            assigned_user_id=conv.assigned_user_id,
            assigned_user_email=assignee_email_map.get(conv.assigned_user_id) if conv.assigned_user_id else None,
            assigned_at=conv.assigned_at,
            lead_score=conv.lead_score or 0,
            lead_score_factors=conv.lead_score_factors,
        ))
    return out


@router.get("/unread-count")
async def get_unread_count(
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Return count of conversations with unread messages."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(func.count()).select_from(WebConversation).where(
            WebConversation.tenant_id == tenant.id,
            or_(
                WebConversation.last_read_at.is_(None),
                WebConversation.last_read_at < WebConversation.last_message_at,
            ),
        )
    )
    count = result.scalar() or 0
    return {"count": count}


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    user_id: str = Depends(require_permission("conversations", "view")),
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
    count_result = await db.execute(select(func.count()).where(WebMessage.conversation_id == conv.id))
    msg_count = count_result.scalar() or 0

    last_read_at = conv.last_read_at
    unread_q = select(func.count()).where(WebMessage.conversation_id == conv.id)
    if last_read_at:
        unread_q = unread_q.where(WebMessage.created_at > last_read_at)
    unread_q = unread_q.where(WebMessage.role != MessageRole.agent)

    unread_result = await db.execute(unread_q)
    unread_count = unread_result.scalar() or 0

    assigned_email: str | None = None
    if conv.assigned_user_id:
        a_res = await db.execute(
            select(User.email).where(User.id == conv.assigned_user_id)
        )
        assigned_email = a_res.scalar_one_or_none()

    return ConversationOut(
        id=conv.id,
        visitor_id=conv.visitor_id,
        page_url=conv.page_url,
        started_at=conv.started_at,
        last_message_at=conv.last_message_at,
        message_count=msg_count,
        unread_count=unread_count,
        visitor_name=conv.visitor_name,
        visitor_email=conv.visitor_email,
        visitor_phone=conv.visitor_phone,
        visitor_address=conv.visitor_address,
        external_user_id=conv.external_user_id,
        mode=conv.mode,
        status=conv.status,
        resolved_at=conv.resolved_at,
        resolved_by_user_id=conv.resolved_by_user_id,
        last_read_at=conv.last_read_at,
        is_unread=unread_count > 0,
        tags=conv.tags,
        assigned_user_id=conv.assigned_user_id,
        assigned_user_email=assigned_email,
        assigned_at=conv.assigned_at,
        lead_score=conv.lead_score or 0,
        lead_score_factors=conv.lead_score_factors,
    )


@router.get("/{conversation_id}/messages", response_model=MessagesPage)
async def get_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(30, ge=1, le=100),
    before: uuid.UUID | None = Query(None, description="Cursor: fetch messages older than this message ID"),
    user_id: str = Depends(require_permission("conversations", "view")),
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


@router.patch("/{conversation_id}/assign", response_model=ConversationOut)
async def assign_conversation(
    conversation_id: uuid.UUID,
    payload: AssignConversationIn,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a conversation to a tenant member (or clear assignment when user_id is null)."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    assigned_email: str | None = None
    if payload.user_id is None:
        conv.assigned_user_id = None
        conv.assigned_at = None
    else:
        try:
            target_uuid = uuid.UUID(payload.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="user_id must be a valid UUID or null")
        # Validate target is in same tenant
        target_res = await db.execute(
            select(User).where(User.id == target_uuid, User.tenant_id == tenant.id)
        )
        target_user = target_res.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found in tenant")
        if not target_user.is_active:
            raise HTTPException(status_code=400, detail="Target user is inactive")
        conv.assigned_user_id = target_user.id
        conv.assigned_at = datetime.now(timezone.utc)
        assigned_email = target_user.email

    await db.commit()
    await db.refresh(conv)

    count_result = await db.execute(select(func.count()).where(WebMessage.conversation_id == conv.id))
    msg_count = count_result.scalar() or 0
    out = ConversationOut.model_validate(conv)
    out.message_count = msg_count
    out.assigned_user_email = assigned_email
    return out


@router.patch("/{conversation_id}/mode", response_model=ConversationOut)
async def set_conversation_mode(
    conversation_id: uuid.UUID,
    payload: SetModeIn,
    user_id: str = Depends(require_permission("conversations", "edit")),
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


@router.patch("/{conversation_id}/status", response_model=ConversationOut)
async def set_conversation_status(
    conversation_id: uuid.UUID,
    payload: SetStatusIn,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Transition a conversation's lifecycle status.

    Valid statuses: open, pending, resolved, closed.
    On transition to "resolved", `resolved_at` and `resolved_by_user_id` are
    stamped with the current time and acting user.
    """
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    new_status = (payload.status or "").strip().lower()
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of {sorted(ALLOWED_STATUSES)}",
        )

    previous_status = conv.status
    conv.status = new_status
    if new_status == "resolved":
        conv.resolved_at = datetime.now(timezone.utc)
        try:
            conv.resolved_by_user_id = uuid.UUID(user_id)
        except (ValueError, TypeError):
            conv.resolved_by_user_id = None
        # ── Salesforce: attach transcript as a Task on the matching Lead ──
        # Fire-and-forget; never blocks the resolve flow if Salesforce is down.
        if conv.visitor_email:
            import asyncio as _asyncio
            from app.services import lead_capture_service as _lcs
            msgs_res = await db.execute(
                select(WebMessage)
                .where(WebMessage.conversation_id == conv.id)
                .order_by(WebMessage.created_at.asc())
            )
            transcript_lines = []
            for m in msgs_res.scalars().all():
                role = m.role.value if hasattr(m.role, "value") else str(m.role)
                transcript_lines.append(f"[{role}] {m.content}")
            transcript = "\n".join(transcript_lines) or "(empty conversation)"
            _asyncio.create_task(
                _lcs.attach_transcript_to_salesforce(
                    tenant=tenant,
                    email=conv.visitor_email,
                    subject=f"Chatbot conversation {conv.id} (resolved)",
                    body=transcript,
                )
            )
    elif new_status == "open":
        # Reopening clears the resolution stamp
        conv.resolved_at = None
        conv.resolved_by_user_id = None

    # ── HubSpot: attach transcript on first resolve (fire-and-forget) ──
    if (
        new_status == "resolved"
        and previous_status != "resolved"
        and conv.visitor_email
        and tenant.hubspot_access_token
    ):
        import asyncio as _asyncio
        from app.core.encryption import decrypt_secret as _decrypt, InvalidToken as _InvalidToken
        from app.services import hubspot_service as _hubspot

        try:
            _hs_token = _decrypt(tenant.hubspot_access_token)
        except _InvalidToken:
            _hs_token = None

        if _hs_token:
            msgs_result = await db.execute(
                select(WebMessage)
                .where(WebMessage.conversation_id == conv.id)
                .order_by(WebMessage.created_at.asc())
            )
            messages = msgs_result.scalars().all()
            lines = []
            for m in messages:
                role = m.role.value if hasattr(m.role, "value") else str(m.role)
                ts = m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else ""
                lines.append(f"[{ts}] {role.upper()}: {m.content or ''}")
            transcript = (
                f"Chat transcript — conversation {conv.id}\n"
                f"Visitor: {conv.visitor_name or ''} <{conv.visitor_email}>\n"
                f"Resolved at: {datetime.now(timezone.utc).isoformat()}\n\n"
                + "\n".join(lines)
            )
            _asyncio.create_task(
                _hubspot.attach_transcript_by_email(
                    token=_hs_token,
                    email=conv.visitor_email,
                    transcript_body=transcript,
                )
            )

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
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_permission("conversations", "edit")),
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

    # Broadcast to widget and dashboard
    from app.core.redis import publish_to_conversation, publish_to_tenant
    msg_payload = {"role": "agent", "content": payload.message, "created_at": msg.created_at.isoformat()}
    await publish_to_conversation(str(conv.id), msg_payload)
    await publish_to_tenant(str(tenant.id), {"type": "new_message", "conversation_id": str(conv.id), "message": msg_payload})

    # 📬 Conversation Continuity (Email Follow-up)
    if conv.visitor_email:
        from app.models.widget import WidgetConfig
        widget_res = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
        widget = widget_res.scalar_one_or_none()
        
        if widget and widget.email_followup_enabled:
            from app.services.email_service import send_visitor_followup
            background_tasks.add_task(
                send_visitor_followup,
                to=conv.visitor_email,
                bot_name=widget.bot_name,
                message_content=payload.message,
                conversation_id=str(conv.id),
                subject=widget.email_followup_subject
            )

    return msg


@router.post("/{conversation_id}/messages/note", response_model=MessageOut)
async def create_internal_note(
    conversation_id: uuid.UUID,
    payload: InternalNoteIn,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Create an agent-only internal note attached to a conversation.

    Internal notes are never returned to visitor-facing endpoints — they exist
    purely for handoff context between human agents.
    """
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

    content = (payload.content or "").strip()
    if not content:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    msg = WebMessage(
        conversation_id=conv.id,
        role=MessageRole.agent,
        content=content,
        is_internal=True,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Broadcast to dashboard only (NOT to the public widget channel) so other
    # agents viewing the conversation see the note in real-time.
    from app.core.redis import publish_to_tenant
    await publish_to_tenant(str(tenant.id), {
        "type": "new_message",
        "conversation_id": str(conv.id),
        "message": {
            "id": str(msg.id),
            "role": "agent",
            "content": msg.content,
            "is_internal": True,
            "created_at": msg.created_at.isoformat(),
        },
    })

    return msg


@router.post("/{conversation_id}/read", status_code=204)
async def mark_as_read(
    conversation_id: uuid.UUID,
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Mark a conversation as read by the current agent."""
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
    conv.last_read_at = datetime.now(timezone.utc)
    await db.commit()

@router.put("/{conversation_id}/tags", response_model=ConversationOut)
async def update_conversation_tags(
    conversation_id: uuid.UUID,
    payload: UpdateTagsIn,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    """Update tags/labels for a conversation."""
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

    conv.tags = payload.tags
    await db.commit()
    await db.refresh(conv)

    # We need to return ConversationOut with counts
    count_result = await db.execute(select(func.count()).where(WebMessage.conversation_id == conv.id))
    msg_count = count_result.scalar() or 0

    out = ConversationOut.model_validate(conv)
    out.message_count = msg_count
    return out


# ── Transcript export ────────────────────────────────────────────────────────

class EmailTranscriptIn(BaseModel):
    to_email: EmailStr


async def _can_view_internal(user_id: str, db: AsyncSession) -> bool:
    """Owners or members with conversations:view_internal/edit can include internal notes."""
    from app.models.user import User, UserRole
    from app.models.role import Role
    from sqlalchemy.orm import selectinload

    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return False
    res = await db.execute(
        select(User)
        .where(User.id == uid)
        .options(selectinload(User.role_obj).selectinload(Role.permissions))
    )
    user = res.scalar_one_or_none()
    if not user:
        return False
    if user.role == UserRole.owner:
        return True
    if user.role_obj is None:
        return False
    return any(
        p.module == "conversations" and p.action in ("view_internal", "edit")
        for p in user.role_obj.permissions
    )


async def _load_export_data(
    conversation_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
    include_internal: bool,
) -> tuple[WebConversation, list[WebMessage]]:
    res = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant_id,
        )
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_q = (
        select(WebMessage)
        .where(WebMessage.conversation_id == conv.id)
        .order_by(WebMessage.created_at.asc())
    )
    if not include_internal:
        msg_q = msg_q.where(WebMessage.is_internal == False)  # noqa: E712
    msg_res = await db.execute(msg_q)
    msgs = list(msg_res.scalars().all())
    return conv, msgs


def _sender_label(msg: WebMessage) -> str:
    if msg.role == MessageRole.user:
        return "Visitor"
    if msg.role == MessageRole.assistant:
        return "AI"
    return "Agent"


def _build_csv(conv: WebConversation, msgs: list[WebMessage]) -> io.StringIO:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "sender", "content", "is_internal"])
    for m in msgs:
        ts = m.created_at.isoformat() if m.created_at else ""
        writer.writerow([ts, _sender_label(m), m.content or "", "true" if m.is_internal else "false"])
    buf.seek(0)
    return buf


def _build_pdf(conv: WebConversation, msgs: list[WebMessage]) -> bytes:
    """Generate a simple PDF transcript using reportlab."""
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title=f"Conversation {conv.id}",
    )
    styles = getSampleStyleSheet()
    h_style = styles["Heading1"]
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], textColor=colors.grey, fontSize=9)
    label_style = ParagraphStyle(
        "label", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#6366f1"), spaceAfter=2
    )
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14)
    internal_style = ParagraphStyle("internal", parent=body_style, textColor=colors.HexColor("#92400e"))

    story: list = []
    story.append(Paragraph("Conversation transcript", h_style))

    visitor = conv.visitor_name or conv.visitor_email or f"Visitor {str(conv.visitor_id)[:8]}"
    started = conv.started_at.strftime("%Y-%m-%d %H:%M UTC") if conv.started_at else "—"
    last = conv.last_message_at.strftime("%Y-%m-%d %H:%M UTC") if conv.last_message_at else "—"
    for line in [
        f"Visitor: {visitor}",
        f"Conversation ID: {conv.id}",
        f"Started: {started}",
        f"Last message: {last}",
        f"Messages: {len(msgs)}",
    ]:
        story.append(Paragraph(line, sub_style))
    story.append(Spacer(1, 0.25 * inch))

    if not msgs:
        story.append(Paragraph("(no messages)", body_style))
    else:
        for m in msgs:
            ts = m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else ""
            sender = _sender_label(m)
            tag = " [INTERNAL]" if m.is_internal else ""
            story.append(Paragraph(
                f"<b>{sender}</b>{tag} &nbsp;<font color='#9ca3af'>{ts}</font>",
                label_style,
            ))
            content = (
                (m.content or "")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\n", "<br/>")
            )
            style = internal_style if m.is_internal else body_style
            story.append(Paragraph(content or "&nbsp;", style))
            story.append(Spacer(1, 0.12 * inch))

    doc.build(story)
    return buf.getvalue()


@router.get("/{conversation_id}/export.csv")
async def export_conversation_csv(
    conversation_id: uuid.UUID,
    include_internal: bool = Query(False),
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Stream a CSV transcript of the conversation."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    if include_internal and not await _can_view_internal(user_id, db):
        include_internal = False
    conv, msgs = await _load_export_data(conversation_id, tenant.id, db, include_internal)
    buf = _build_csv(conv, msgs)
    filename = f"conversation-{conv.id}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{conversation_id}/export.pdf")
async def export_conversation_pdf(
    conversation_id: uuid.UUID,
    include_internal: bool = Query(False),
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Return a PDF transcript of the conversation."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    if include_internal and not await _can_view_internal(user_id, db):
        include_internal = False
    conv, msgs = await _load_export_data(conversation_id, tenant.id, db, include_internal)
    pdf_bytes = _build_pdf(conv, msgs)
    filename = f"conversation-{conv.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{conversation_id}/email-transcript", status_code=202)
async def email_conversation_transcript(
    conversation_id: uuid.UUID,
    payload: EmailTranscriptIn,
    background_tasks: BackgroundTasks,
    include_internal: bool = Query(False),
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Email a PDF transcript to the given address. Silently no-ops if RESEND_API_KEY is unset."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    if include_internal and not await _can_view_internal(user_id, db):
        include_internal = False
    conv, msgs = await _load_export_data(conversation_id, tenant.id, db, include_internal)
    pdf_bytes = _build_pdf(conv, msgs)
    background_tasks.add_task(
        email_service.send_transcript,
        to_email=payload.to_email,
        pdf_bytes=pdf_bytes,
        conversation_id=str(conv.id),
    )
    return {"status": "queued", "to_email": payload.to_email}


# ── Lead scoring ─────────────────────────────────────────────────────────────
# Additions for the lead scoring feature live at the bottom of this file so
# they don't conflict with other agents editing the router concurrently.

@router.post("/{conversation_id}/recompute-score")
async def recompute_lead_score(
    conversation_id: uuid.UUID,
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Manually recompute the lead score for a conversation and return the result."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    from app.services.lead_scoring_service import recompute_score
    score, factors = await recompute_score(conv, db)
    conv.lead_score = score
    conv.lead_score_factors = factors
    await db.commit()
    return {"lead_score": score, "lead_score_factors": factors}

