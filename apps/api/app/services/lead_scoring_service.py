"""
Lead scoring — converts behavior signals into a numeric 0-100 score.

Scoring rules (each rule documented inline):
- Email captured: +20
- Phone captured: +15
- Name captured: +5
- Address captured: +5
- 5+ visitor messages: +10
- 10+ visitor messages: +15 (cumulative; a long conversation gets both tiers = +25)
- Visited pricing/checkout/contact URL (substring match on page_url): +15
- Hot keywords in any visitor message
  ("buy", "purchase", "demo", "pricing", "trial", "quote"): +15
- Goal completion (one row in goal_completions for this conversation): +25 per goal
- Hard cap at 100.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import WebConversation, WebMessage, MessageRole
from app.models.goal import GoalCompletion

logger = logging.getLogger(__name__)

HOT_KEYWORDS = ("buy", "purchase", "demo", "pricing", "trial", "quote")
INTENT_URL_TOKENS = ("pricing", "checkout", "contact")

# Point weights — kept here so the rules are easy to tweak.
W_EMAIL = 20
W_PHONE = 15
W_NAME = 5
W_ADDRESS = 5
W_MSG_5 = 10
W_MSG_10 = 15
W_INTENT_URL = 15
W_HOT_KEYWORD = 15
W_GOAL = 25

SCORE_CAP = 100


async def recompute_score(
    conversation: WebConversation,
    db: AsyncSession,
) -> tuple[int, dict[str, int]]:
    """Compute (score, factors) for a conversation.

    Pulls related data (messages, goal completions) from the DB so callers
    don't have to preload anything. Returns the breakdown — the caller is
    responsible for writing it back to the conversation row.
    """
    factors: dict[str, int] = {}

    # ── Identity capture ──
    if conversation.visitor_email:
        factors["email_captured"] = W_EMAIL
    if conversation.visitor_phone:
        factors["phone_captured"] = W_PHONE
    if conversation.visitor_name:
        factors["name_captured"] = W_NAME
    if conversation.visitor_address:
        factors["address_captured"] = W_ADDRESS

    # ── Visitor message count tiers ──
    msg_q = select(func.count()).where(
        WebMessage.conversation_id == conversation.id,
        WebMessage.role == MessageRole.user,
    )
    visitor_msg_count = (await db.execute(msg_q)).scalar() or 0
    if visitor_msg_count >= 5:
        factors["messages_5plus"] = W_MSG_5
    if visitor_msg_count >= 10:
        factors["messages_10plus"] = W_MSG_10

    # ── Intent URL (pricing / checkout / contact) ──
    if conversation.page_url:
        url_lower = conversation.page_url.lower()
        if any(tok in url_lower for tok in INTENT_URL_TOKENS):
            factors["intent_page_visited"] = W_INTENT_URL

    # ── Hot keywords in any visitor message ──
    kw_q = select(WebMessage.content).where(
        WebMessage.conversation_id == conversation.id,
        WebMessage.role == MessageRole.user,
    )
    kw_rows = (await db.execute(kw_q)).scalars().all()
    blob = " ".join((c or "").lower() for c in kw_rows)
    if any(kw in blob for kw in HOT_KEYWORDS):
        factors["hot_keyword"] = W_HOT_KEYWORD

    # ── Goal completions ──
    goal_q = select(func.count()).where(
        GoalCompletion.conversation_id == conversation.id,
        GoalCompletion.tenant_id == conversation.tenant_id,
    )
    goal_count = (await db.execute(goal_q)).scalar() or 0
    if goal_count > 0:
        factors["goal_completions"] = W_GOAL * int(goal_count)

    raw = sum(factors.values())
    score = min(raw, SCORE_CAP)
    return score, factors


async def recompute_score_for_conversation(
    conversation_id: uuid.UUID | str,
    db: AsyncSession,
) -> tuple[int, dict[str, int]] | None:
    """Look up the conversation, compute the score, and persist it.

    Safe to call from a FastAPI BackgroundTasks. Returns (score, factors) on
    success or None if the conversation no longer exists.
    """
    try:
        if isinstance(conversation_id, str):
            conversation_id = uuid.UUID(conversation_id)
        result = await db.execute(
            select(WebConversation).where(WebConversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            return None

        score, factors = await recompute_score(conv, db)
        conv.lead_score = score
        conv.lead_score_factors = factors
        await db.commit()
        return score, factors
    except Exception as exc:  # noqa: BLE001 — background task should never raise
        logger.warning(f"[lead_scoring] recompute failed for {conversation_id}: {exc}")
        try:
            await db.rollback()
        except Exception:
            pass
        return None


async def recompute_score_in_new_session(conversation_id: uuid.UUID | str) -> None:
    """Background-task entrypoint that opens its own DB session.

    Use this from BackgroundTasks where the request-scoped session is already
    closed by the time the task runs.
    """
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await recompute_score_for_conversation(conversation_id, session)
