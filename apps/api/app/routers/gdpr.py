"""GDPR data subject access endpoints.

Owner-only endpoints for handling data export and deletion / anonymization
requests per the EU General Data Protection Regulation (Articles 15, 17).

All operations are STRICTLY scoped to the requesting user's tenant_id —
never cross-tenant. The tenant filter is applied to every query / mutation.

TODO: When an audit-log service exists, record every export/delete here
with the requesting user_id, target visitor_id/email, and counts.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, model_validator
from sqlalchemy import and_, or_, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_owner
from app.models.conversation import WebConversation, WebMessage
from app.models.conversation_rating import ConversationRating
from app.services import auth_service, audit_service

router = APIRouter(prefix="/api/gdpr", tags=["gdpr"])


# ─── Schemas ──────────────────────────────────────────────────────────────────


class DeleteRequest(BaseModel):
    visitor_id: Optional[str] = None
    email: Optional[str] = None
    mode: Literal["anonymize", "hard_delete"]

    @model_validator(mode="after")
    def _require_identifier(self) -> "DeleteRequest":
        if not self.visitor_id and not self.email:
            raise ValueError("Either visitor_id or email must be provided")
        return self


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _build_match_clause(tenant_id, visitor_id: Optional[str], email: Optional[str]):
    """Return a WHERE clause that matches conversations for THIS tenant only.

    The tenant_id filter is REQUIRED — never construct a clause without it.
    """
    if not visitor_id and not email:
        raise HTTPException(status_code=400, detail="visitor_id or email required")

    identifier_clauses = []
    if visitor_id:
        identifier_clauses.append(WebConversation.visitor_id == visitor_id)
    if email:
        identifier_clauses.append(WebConversation.visitor_email == email)

    # Tenant filter is ALWAYS applied. Do not remove.
    return and_(
        WebConversation.tenant_id == tenant_id,
        or_(*identifier_clauses),
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/export")
async def export_visitor_data(
    request: Request,
    visitor_id: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    """Export all personal data for a visitor as JSON (GDPR Art. 15)."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    where = _build_match_clause(tenant.id, visitor_id, email)

    conv_result = await db.execute(select(WebConversation).where(where))
    conversations = list(conv_result.scalars().all())

    conv_ids = [c.id for c in conversations]
    messages: list[WebMessage] = []
    ratings: list[ConversationRating] = []
    if conv_ids:
        msg_result = await db.execute(
            select(WebMessage).where(WebMessage.conversation_id.in_(conv_ids))
        )
        messages = list(msg_result.scalars().all())

        # ConversationRating already carries tenant_id — filter both for safety.
        rating_result = await db.execute(
            select(ConversationRating).where(
                and_(
                    ConversationRating.tenant_id == tenant.id,
                    ConversationRating.conversation_id.in_(conv_ids),
                )
            )
        )
        ratings = list(rating_result.scalars().all())

    await audit_service.log(
        db,
        tenant_id=tenant.id,
        actor_user_id=user_id,
        action="gdpr.export",
        target_type="visitor",
        target_id=visitor_id or email,
        metadata={
            "visitor_id": visitor_id,
            "email": email,
            "conversations": len(conversations),
            "messages": len(messages),
            "ratings": len(ratings),
        },
        request=request,
    )
    await db.commit()

    return {
        "tenant_id": str(tenant.id),
        "query": {"visitor_id": visitor_id, "email": email},
        "counts": {
            "conversations": len(conversations),
            "messages": len(messages),
            "ratings": len(ratings),
        },
        "conversations": [
            {
                "id": str(c.id),
                "visitor_id": c.visitor_id,
                "visitor_name": c.visitor_name,
                "visitor_email": c.visitor_email,
                "visitor_phone": c.visitor_phone,
                "visitor_address": getattr(c, "visitor_address", None),
                "page_url": c.page_url,
                "external_user_id": c.external_user_id,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "tags": list(c.tags) if c.tags else [],
                "mode": c.mode,
            }
            for c in conversations
        ],
        "messages": [
            {
                "id": str(m.id),
                "conversation_id": str(m.conversation_id),
                "role": m.role.value if hasattr(m.role, "value") else str(m.role),
                "content": m.content,
                "attachment_url": m.attachment_url,
                "tokens_used": m.tokens_used,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
        "ratings": [
            {
                "id": str(r.id),
                "conversation_id": str(r.conversation_id),
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in ratings
        ],
        # Lead-related personal data on these conversations is already covered
        # by the visitor_* fields above. LeadCaptureConfig is tenant-level
        # configuration (no per-visitor PII) so it is intentionally excluded.
        "leads": [],
    }


@router.post("/delete")
async def delete_visitor_data(
    body: DeleteRequest,
    request: Request,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    """Anonymize or hard-delete all data for a visitor (GDPR Art. 17)."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    where = _build_match_clause(tenant.id, body.visitor_id, body.email)

    # Capture the affected conversation ids FIRST (still tenant-filtered).
    conv_result = await db.execute(select(WebConversation.id).where(where))
    conv_ids = [row[0] for row in conv_result.all()]

    if not conv_ids:
        await audit_service.log(
            db,
            tenant_id=tenant.id,
            actor_user_id=user_id,
            action=f"gdpr.{body.mode}",
            target_type="visitor",
            target_id=body.visitor_id or body.email,
            metadata={
                "visitor_id": body.visitor_id,
                "email": body.email,
                "conversations": 0,
                "messages": 0,
                "ratings": 0,
            },
            request=request,
        )
        await db.commit()
        return {
            "mode": body.mode,
            "conversations_affected": 0,
            "messages_affected": 0,
            "ratings_affected": 0,
        }

    messages_affected = 0
    conversations_affected = 0
    ratings_affected = 0

    if body.mode == "anonymize":
        # Replace visitor PII with REDACTED / NULL while preserving the row.
        upd = (
            update(WebConversation)
            .where(
                and_(
                    WebConversation.tenant_id == tenant.id,  # defense-in-depth
                    WebConversation.id.in_(conv_ids),
                )
            )
            .values(
                visitor_id="REDACTED",
                visitor_name=None,
                visitor_email=None,
                visitor_phone=None,
                visitor_address=None,
                external_user_id=None,
                page_url=None,
            )
        )
        res = await db.execute(upd)
        conversations_affected = res.rowcount or len(conv_ids)

        # Redact message content as well — assistant replies can echo PII.
        msg_upd = (
            update(WebMessage)
            .where(WebMessage.conversation_id.in_(conv_ids))
            .values(content="[REDACTED]", attachment_url=None)
        )
        msg_res = await db.execute(msg_upd)
        messages_affected = msg_res.rowcount or 0

        # Strip free-form rating comments (PII) but keep the numeric score.
        rating_upd = (
            update(ConversationRating)
            .where(
                and_(
                    ConversationRating.tenant_id == tenant.id,
                    ConversationRating.conversation_id.in_(conv_ids),
                )
            )
            .values(comment=None)
        )
        rating_res = await db.execute(rating_upd)
        ratings_affected = rating_res.rowcount or 0

    elif body.mode == "hard_delete":
        # Count messages first (for the response), then delete conversations.
        # WebMessage has ondelete=CASCADE on conversation_id so deleting the
        # parent rows is sufficient.
        msg_count_res = await db.execute(
            select(WebMessage.id).where(WebMessage.conversation_id.in_(conv_ids))
        )
        messages_affected = len(msg_count_res.all())

        # Count ratings before cascade.
        rating_count_res = await db.execute(
            select(ConversationRating.id).where(
                and_(
                    ConversationRating.tenant_id == tenant.id,
                    ConversationRating.conversation_id.in_(conv_ids),
                )
            )
        )
        ratings_affected = len(rating_count_res.all())

        del_stmt = delete(WebConversation).where(
            and_(
                WebConversation.tenant_id == tenant.id,  # defense-in-depth
                WebConversation.id.in_(conv_ids),
            )
        )
        res = await db.execute(del_stmt)
        conversations_affected = res.rowcount or len(conv_ids)

    await audit_service.log(
        db,
        tenant_id=tenant.id,
        actor_user_id=user_id,
        action=f"gdpr.{body.mode}",
        target_type="visitor",
        target_id=body.visitor_id or body.email,
        metadata={
            "visitor_id": body.visitor_id,
            "email": body.email,
            "conversations": conversations_affected,
            "messages": messages_affected,
            "ratings": ratings_affected,
        },
        request=request,
    )
    await db.commit()

    return {
        "mode": body.mode,
        "conversations_affected": conversations_affected,
        "messages_affected": messages_affected,
        "ratings_affected": ratings_affected,
    }
