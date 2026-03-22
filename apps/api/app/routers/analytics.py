from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.conversation import WebConversation, WebMessage
from app.services import auth_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class AnalyticsSummary(BaseModel):
    total_conversations: int
    total_messages: int
    messages_this_month: int
    avg_messages_per_conversation: float


@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    user_id: str = Depends(get_current_user_id),
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

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    msgs_this_month = await db.scalar(
        select(func.count(WebMessage.id))
        .join(WebConversation)
        .where(
            WebConversation.tenant_id == tenant.id,
            WebMessage.created_at >= month_start,
        )
    ) or 0

    avg = (total_msgs / total_convs) if total_convs > 0 else 0.0

    return AnalyticsSummary(
        total_conversations=total_convs,
        total_messages=total_msgs,
        messages_this_month=msgs_this_month,
        avg_messages_per_conversation=round(avg, 2),
    )
