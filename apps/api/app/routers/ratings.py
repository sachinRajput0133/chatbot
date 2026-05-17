import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.conversation import WebConversation
from app.models.conversation_rating import ConversationRating
from app.services import auth_service

router = APIRouter(tags=["ratings"])


class RatingIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class RatingOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    rating: int
    comment: Optional[str] = None
    created_at: str

    @classmethod
    def from_orm_obj(cls, r: ConversationRating) -> "RatingOut":
        return cls(
            id=r.id,
            conversation_id=r.conversation_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at.isoformat(),
        )


@router.post("/api/widget/conversations/{conversation_id}/rating", response_model=RatingOut)
async def submit_rating_public(
    conversation_id: uuid.UUID,
    payload: RatingIn,
    db: AsyncSession = Depends(get_db),
):
    """Public widget endpoint — visitor submits a CSAT rating for a conversation.

    Verified by conversation existence; no auth. One rating per conversation.
    """
    result = await db.execute(
        select(WebConversation).where(WebConversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    existing = await db.execute(
        select(ConversationRating).where(ConversationRating.conversation_id == conversation_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Rating already submitted for this conversation")

    rating = ConversationRating(
        tenant_id=conv.tenant_id,
        conversation_id=conv.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(rating)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Rating already submitted for this conversation")
    await db.refresh(rating)
    return RatingOut.from_orm_obj(rating)


@router.get("/api/conversations/{conversation_id}/rating", response_model=RatingOut | None)
async def get_rating(
    conversation_id: uuid.UUID,
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated dashboard endpoint — fetch CSAT rating for a conversation."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    conv_res = await db.execute(
        select(WebConversation).where(
            WebConversation.id == conversation_id,
            WebConversation.tenant_id == tenant.id,
        )
    )
    if not conv_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    rating_res = await db.execute(
        select(ConversationRating).where(ConversationRating.conversation_id == conversation_id)
    )
    rating = rating_res.scalar_one_or_none()
    if not rating:
        return None
    return RatingOut.from_orm_obj(rating)
