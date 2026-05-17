import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models import WebConversation, WebMessage
from app.schemas.lead_capture import LeadCaptureConfigOut, LeadCaptureConfigUpdate
from app.services import auth_service, lead_capture_service

router = APIRouter(prefix="/api/lead-capture", tags=["lead-capture"])


async def _get_tenant(user_id: str, db: AsyncSession):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return tenant


@router.get("/config", response_model=LeadCaptureConfigOut)
async def get_lead_config(
    user_id: str = Depends(require_permission("lead_capture", "view")),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    config = await lead_capture_service.get_config(tenant.id, db)
    if config is None:
        # No row yet — return defaults without persisting
        return LeadCaptureConfigOut(
            enabled=False,
            collect_name=True,
            collect_email=True,
            collect_phone=False,
            collect_company=False,
            collect_job_title=False,
            collect_address=False,
            custom_questions=[],
            skip_if_filled=True,
            trigger_after=1,
            display_style="inline",
            collect_timing="after_specific_message",
            required_field_label="* Required",
        )
    return config


@router.put("/config", response_model=LeadCaptureConfigOut)
async def update_lead_config(
    data: LeadCaptureConfigUpdate,
    user_id: str = Depends(require_permission("lead_capture", "manage")),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    return await lead_capture_service.upsert_config(tenant.id, updates, db)


@router.get("/export.csv")
async def export_leads_csv(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    user_id: str = Depends(require_permission("lead_capture", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Export all captured leads (web_conversations with any visitor contact info) as CSV."""
    tenant = await _get_tenant(user_id, db)

    # Parse optional date range (YYYY-MM-DD). `to` is inclusive (end of day).
    def _parse_date(value: str | None, end_of_day: bool = False) -> datetime | None:
        if not value:
            return None
        try:
            dt = datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date '{value}', expected YYYY-MM-DD")
        if end_of_day:
            dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        return dt.replace(tzinfo=timezone.utc)

    from_dt = _parse_date(from_)
    to_dt = _parse_date(to, end_of_day=True)

    # Subquery for message counts per conversation
    msg_count_sq = (
        select(WebMessage.conversation_id, func.count().label("msg_count"))
        .group_by(WebMessage.conversation_id)
        .subquery()
    )

    stmt = (
        select(WebConversation, func.coalesce(msg_count_sq.c.msg_count, 0))
        .outerjoin(msg_count_sq, msg_count_sq.c.conversation_id == WebConversation.id)
        .where(
            WebConversation.tenant_id == tenant.id,
            or_(
                WebConversation.visitor_name.is_not(None),
                WebConversation.visitor_email.is_not(None),
                WebConversation.visitor_phone.is_not(None),
            ),
        )
        .order_by(WebConversation.started_at.desc())
    )
    if from_dt is not None:
        stmt = stmt.where(WebConversation.started_at >= from_dt)
    if to_dt is not None:
        stmt = stmt.where(WebConversation.started_at <= to_dt)

    result = await db.execute(stmt)
    rows = result.all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "visitor_id",
        "visitor_name",
        "visitor_email",
        "visitor_phone",
        "visitor_address",
        "page_url",
        "tags",
        "started_at",
        "last_active_at",
        "message_count",
        "status",
    ])
    for conv, msg_count in rows:
        writer.writerow([
            conv.visitor_id or "",
            conv.visitor_name or "",
            conv.visitor_email or "",
            conv.visitor_phone or "",
            conv.visitor_address or "",
            conv.page_url or "",
            ",".join(conv.tags or []),
            conv.started_at.isoformat() if conv.started_at else "",
            conv.last_message_at.isoformat() if conv.last_message_at else "",
            int(msg_count or 0),
            conv.status or "",
        ])

    buf.seek(0)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"leads-{today}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
