from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.conversation import WebConversation, WebMessage
from app.services import auth_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class TrendDataPoint(BaseModel):
    date: str
    messages: int


class AnalyticsSummary(BaseModel):
    total_conversations: int
    total_messages: int
    messages_this_month: int
    avg_messages_per_conversation: float
    performance_trends: list[TrendDataPoint]


@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    user_id: str = Depends(require_permission("analytics", "view")),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    total_convs = await db.scalar(
        select(func.count()).where(WebConversation.tenant_id == tenant.id)
    ) or 0

    total_msgs = await db.scalar(
        select(func.count(WebMessage.id))
        .join(WebConversation)
        .where(WebConversation.tenant_id == tenant.id)
    ) or 0

    now_utc = datetime.now(timezone.utc)
    month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    msgs_this_month = await db.scalar(
        select(func.count(WebMessage.id))
        .join(WebConversation)
        .where(
            WebConversation.tenant_id == tenant.id,
            WebMessage.created_at >= month_start,
        )
    ) or 0

    avg = (total_msgs / total_convs) if total_convs > 0 else 0.0

    # Get performance trends (last 7 days)
    seven_days_ago = now_utc - timedelta(days=7)
    trend_result = await db.execute(
        select(
            func.date(WebMessage.created_at).label("day"),
            func.count(WebMessage.id).label("count")
        )
        .join(WebConversation)
        .where(
            WebConversation.tenant_id == tenant.id,
            WebMessage.created_at >= seven_days_ago
        )
        .group_by(func.date(WebMessage.created_at))
    )
    
    trend_dict = {str(row.day): row.count for row in trend_result.fetchall()}
    
    # Fill in missing days
    trends = []
    for i in range(6, -1, -1):
        day = (now_utc - timedelta(days=i)).date()
        day_str = str(day)
        trends.append(TrendDataPoint(
            date=day_str,
            messages=trend_dict.get(day_str, 0)
        ))

    return AnalyticsSummary(
        total_conversations=total_convs,
        total_messages=total_msgs,
        messages_this_month=msgs_this_month,
        avg_messages_per_conversation=round(avg, 2),
        performance_trends=trends
    )
