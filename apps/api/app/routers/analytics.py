from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.conversation import WebConversation, WebMessage
from app.models.conversation_rating import ConversationRating
from app.services import auth_service
from app.services.chat_service import AI_FAILURE_FALLBACK

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
    avg_csat: float | None
    csat_count: int
    csat_distribution: dict[str, int]


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

    # CSAT aggregates
    csat_row = (
        await db.execute(
            select(
                func.avg(ConversationRating.rating),
                func.count(ConversationRating.id),
            ).where(ConversationRating.tenant_id == tenant.id)
        )
    ).one()
    avg_csat_val: float | None = float(csat_row[0]) if csat_row[0] is not None else None
    csat_count = int(csat_row[1] or 0)

    dist_rows = await db.execute(
        select(ConversationRating.rating, func.count(ConversationRating.id))
        .where(ConversationRating.tenant_id == tenant.id)
        .group_by(ConversationRating.rating)
    )
    csat_distribution = {str(i): 0 for i in range(1, 6)}
    for star, cnt in dist_rows.all():
        csat_distribution[str(int(star))] = int(cnt)

    return AnalyticsSummary(
        total_conversations=total_convs,
        total_messages=total_msgs,
        messages_this_month=msgs_this_month,
        avg_messages_per_conversation=round(avg, 2),
        performance_trends=trends,
        avg_csat=round(avg_csat_val, 2) if avg_csat_val is not None else None,
        csat_count=csat_count,
        csat_distribution=csat_distribution,
    )


# Patterns that suggest the bot couldn't answer the visitor's question.
UNANSWERED_PATTERNS = [
    "i don't know",
    "i'm not sure",
    "i don't have",
    "i do not have",
    "i can't find",
    "i cannot find",
    "outside my knowledge",
    "unable to find",
    "don't have that information",
    "do not have that information",
    AI_FAILURE_FALLBACK.lower(),
]


class UnansweredQuestion(BaseModel):
    question: str
    count: int
    last_asked: datetime
    sample_conversation_id: str


@router.get("/unanswered", response_model=list[UnansweredQuestion])
async def get_unanswered(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(require_permission("analytics", "view")),
    db: AsyncSession = Depends(get_db),
):
    """
    Top visitor questions where the immediately-following bot reply
    matched a "don't know" pattern. Grouped case-insensitively.
    """
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    since = datetime.now(timezone.utc) - timedelta(days=days)

    sql = text(
        """
        WITH ordered AS (
            SELECT
                m.id,
                m.conversation_id,
                m.role,
                m.content,
                m.created_at,
                LEAD(m.role)       OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.id) AS next_role,
                LEAD(m.content)    OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.id) AS next_content
            FROM web_messages m
            JOIN web_conversations c ON c.id = m.conversation_id
            WHERE c.tenant_id = :tenant_id
              AND m.created_at >= :since
              AND COALESCE(m.is_internal, false) = false
        ),
        unanswered AS (
            SELECT
                TRIM(content) AS question,
                LOWER(TRIM(content)) AS norm_q,
                conversation_id,
                created_at
            FROM ordered
            WHERE role = 'user'
              AND next_role IN ('assistant', 'agent')
              AND next_content IS NOT NULL
              AND LOWER(next_content) ~* :pattern
              AND LENGTH(TRIM(content)) > 0
        )
        SELECT
            MIN(question) AS question,
            COUNT(*)      AS cnt,
            MAX(created_at) AS last_asked,
            (ARRAY_AGG(conversation_id ORDER BY created_at DESC))[1] AS sample_conversation_id
        FROM unanswered
        GROUP BY norm_q
        ORDER BY cnt DESC, last_asked DESC
        LIMIT :limit
        """
    )

    # Build a single regex alternation. Escape regex meta chars in each phrase.
    import re as _re
    pattern = "|".join(_re.escape(p) for p in UNANSWERED_PATTERNS)

    result = await db.execute(
        sql,
        {
            "tenant_id": str(tenant.id),
            "since": since,
            "pattern": pattern,
            "limit": limit,
        },
    )

    rows = result.fetchall()
    return [
        UnansweredQuestion(
            question=row.question,
            count=int(row.cnt),
            last_asked=row.last_asked,
            sample_conversation_id=str(row.sample_conversation_id),
        )
        for row in rows
    ]
