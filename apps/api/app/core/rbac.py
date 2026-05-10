"""
Role-based access control dependencies.

Usage in a router:
    @router.get("/billing", dependencies=[Depends(require_permission("billing", "view"))])
    async def list_billing(user_id: str = Depends(get_current_user_id)): ...

Or use the wrapped form which still yields user_id:
    user_id: str = Depends(require_permission("billing", "view"))

Owners (User.role == owner) bypass all permission checks.
Inactive users (is_active=False) are denied at this layer regardless of role.
Users with must_change_password=True are blocked from every gated route except
the change-password endpoint itself — defense in depth alongside the frontend
redirect.
"""
import uuid
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User, UserRole
from app.models.role import Role


_PermSet = frozenset[tuple[str, str]]


async def _load_user_with_perms(user_id: str, db: AsyncSession) -> tuple[User, _PermSet]:
    """Load user and (if member) their role permissions in one query."""
    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    result = await db.execute(
        select(User)
        .where(User.id == uid)
        .options(selectinload(User.role_obj).selectinload(Role.permissions))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    if user.role == UserRole.owner:
        # Owners bypass — empty perm set is fine; checks short-circuit on role.
        return user, frozenset()

    perms: set[tuple[str, str]] = set()
    if user.role_obj is not None:
        for p in user.role_obj.permissions:
            perms.add((p.module, p.action))
    return user, frozenset(perms)


async def _get_or_load(request: Request, user_id: str, db: AsyncSession) -> tuple[User, _PermSet]:
    """Cache the (user, perms) tuple on request.state so multi-check requests hit DB once."""
    cached = getattr(request.state, "_rbac_cache", None)
    if cached and cached[0] == user_id:
        return cached[1], cached[2]
    user, perms = await _load_user_with_perms(user_id, db)
    request.state._rbac_cache = (user_id, user, perms)
    return user, perms


def require_permission(module: str, action: str):
    """Returns a FastAPI dependency that asserts the current user has the permission.

    The dependency yields `user_id` (str) on success, so it can be used as a
    drop-in replacement for `Depends(get_current_user_id)`.
    """

    async def _dep(
        request: Request,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> str:
        user, perms = await _get_or_load(request, user_id, db)

        # Block all gated routes for users who haven't completed their forced
        # password reset — except the dedicated reset endpoint itself, which
        # depends on get_current_user_id directly (not on this).
        if user.must_change_password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "MUST_CHANGE_PASSWORD", "message": "Password reset required before continuing"},
            )

        if user.role == UserRole.owner:
            return user_id

        if (module, action) not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: requires {module}:{action}",
            )
        return user_id

    return _dep


def require_owner():
    """Dependency that allows only tenant owners."""

    async def _dep(
        request: Request,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> str:
        user, _ = await _get_or_load(request, user_id, db)
        if user.must_change_password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "MUST_CHANGE_PASSWORD", "message": "Password reset required before continuing"},
            )
        if user.role != UserRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owner-only action",
            )
        return user_id

    return _dep


async def get_user_permissions_list(user_id: str, db: AsyncSession) -> list[str]:
    """Public helper: returns the user's permissions as `["module:action", ...]`.

    Used by /api/auth/me to hydrate the frontend permission cache.
    Owners receive a single sentinel `"*:*"` entry to indicate full access.
    """
    user, perms = await _load_user_with_perms(user_id, db)
    if user.role == UserRole.owner:
        return ["*:*"]
    return sorted(f"{m}:{a}" for m, a in perms)
