"""Minimal members list for in-app pickers (e.g. conversation assignee dropdown).

Unlike /api/users (owner-only management), this endpoint exposes a lightweight
view of active tenant members to anyone who can view conversations.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.user import User
from app.services import auth_service
from pydantic import BaseModel


class MemberOut(BaseModel):
    id: str
    email: str

    class Config:
        from_attributes = True


router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
async def list_members(
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    """Return active members of the current tenant (id + email only)."""
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(User.id, User.email)
        .where(User.tenant_id == tenant.id, User.is_active.is_(True))
        .order_by(User.email.asc())
    )
    return [MemberOut(id=str(row[0]), email=row[1]) for row in result.all()]
