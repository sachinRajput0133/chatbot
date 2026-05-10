"""User invitation + management for tenant owners."""
import secrets
import uuid
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, BackgroundTasks

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.models.role import Role
from app.models.tenant import Tenant
from app.schemas.user_admin import (
    InviteUserRequest, UpdateUserRequest, UserAdminOut, InviteUserResponse,
)
from app.services import email_service
from app.core.config import settings


def _to_out(user: User) -> UserAdminOut:
    return UserAdminOut(
        id=str(user.id),
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        role_id=str(user.role_id) if user.role_id else None,
        role_name=user.role_obj.name if user.role_obj else None,
        must_change_password=user.must_change_password,
        is_active=user.is_active,
        created_at=user.created_at,
    )


def _parse_uuid(value: str, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"Invalid {field}")


def _generate_temp_password() -> str:
    """12-character URL-safe random string."""
    return secrets.token_urlsafe(9)[:12]


async def list_users(tenant_id: uuid.UUID, db: AsyncSession) -> list[UserAdminOut]:
    result = await db.execute(
        select(User)
        .where(User.tenant_id == tenant_id)
        .options(selectinload(User.role_obj))
        .order_by(User.created_at.asc())
    )
    return [_to_out(u) for u in result.scalars().all()]


async def _count_active_owners(tenant_id: uuid.UUID, db: AsyncSession, exclude_user_id: uuid.UUID | None = None) -> int:
    q = select(func.count(User.id)).where(and_(
        User.tenant_id == tenant_id,
        User.role == UserRole.owner,
        User.is_active.is_(True),
    ))
    if exclude_user_id is not None:
        q = q.where(User.id != exclude_user_id)
    result = await db.execute(q)
    return result.scalar() or 0


async def invite_user(
    *,
    tenant_id: uuid.UUID,
    inviter_id: uuid.UUID,
    data: InviteUserRequest,
    db: AsyncSession,
    background_tasks: BackgroundTasks,
) -> InviteUserResponse:
    email_norm = data.email.strip().lower()

    # Email globally unique (existing constraint).
    existing = await db.execute(select(User).where(User.email == email_norm))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    role_uuid = _parse_uuid(data.role_id, "role_id")
    role_q = await db.execute(
        select(Role).where(and_(Role.id == role_uuid, Role.tenant_id == tenant_id))
    )
    role = role_q.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system and role.name == "Owner":
        # Owner system role grants full access; we still allow assignment but
        # surface it explicitly so the invited user becomes a system owner too.
        # This is intentional — tenant can have multiple owners.
        new_system_role = UserRole.owner
    else:
        new_system_role = UserRole.member

    # Inviter (for the email greeting + audit)
    inviter_q = await db.execute(select(User).where(User.id == inviter_id))
    inviter = inviter_q.scalar_one_or_none()

    # Tenant (business name for email)
    tenant_q = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_q.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    temp_password = _generate_temp_password()

    user = User(
        tenant_id=tenant_id,
        email=email_norm,
        password_hash=hash_password(temp_password),
        role=new_system_role,
        role_id=role.id,
        must_change_password=True,
        is_active=True,
        invited_by_user_id=inviter_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    user.role_obj = role  # avoid an extra query in _to_out

    login_url = f"{settings.FRONTEND_URL}/login"
    inviter_name = (inviter.email if inviter else tenant.business_name)
    background_tasks.add_task(
        email_service.send_invitation,
        to=email_norm,
        business_name=tenant.business_name,
        inviter_name=inviter_name,
        temp_password=temp_password,
        login_url=login_url,
        role_name=role.name,
    )

    return InviteUserResponse(user=_to_out(user), invitation_email_sent=True)


async def update_user(
    *,
    user_id: str,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID,
    data: UpdateUserRequest,
    db: AsyncSession,
) -> UserAdminOut:
    target_uuid = _parse_uuid(user_id, "user_id")
    result = await db.execute(
        select(User)
        .where(and_(User.id == target_uuid, User.tenant_id == tenant_id))
        .options(selectinload(User.role_obj))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Role change
    if data.role_id is not None:
        role_uuid = _parse_uuid(data.role_id, "role_id")
        role_q = await db.execute(
            select(Role).where(and_(Role.id == role_uuid, Role.tenant_id == tenant_id))
        )
        new_role = role_q.scalar_one_or_none()
        if not new_role:
            raise HTTPException(status_code=404, detail="Role not found")

        # Determine whether the new system role is owner or member
        becoming_owner = new_role.is_system and new_role.name == "Owner"
        becoming_member = not becoming_owner

        # Block demoting the LAST owner
        if user.role == UserRole.owner and becoming_member:
            other_owners = await _count_active_owners(tenant_id, db, exclude_user_id=user.id)
            if other_owners == 0:
                raise HTTPException(status_code=409, detail="Cannot demote the last owner")

        user.role = UserRole.owner if becoming_owner else UserRole.member
        user.role_id = new_role.id
        user.role_obj = new_role

    # Active flag toggle
    if data.is_active is not None:
        if data.is_active is False:
            # Cannot deactivate self
            if user.id == actor_id:
                raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
            # Cannot deactivate the last owner
            if user.role == UserRole.owner:
                other_owners = await _count_active_owners(tenant_id, db, exclude_user_id=user.id)
                if other_owners == 0:
                    raise HTTPException(status_code=409, detail="Cannot deactivate the last owner")
        user.is_active = data.is_active

    await db.commit()
    await db.refresh(user)
    return _to_out(user)


async def delete_user(
    *,
    user_id: str,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Soft-delete via is_active=False to preserve conversation history attribution."""
    target_uuid = _parse_uuid(user_id, "user_id")
    if target_uuid == actor_id:
        raise HTTPException(status_code=400, detail="You cannot remove your own account")

    result = await db.execute(
        select(User).where(and_(User.id == target_uuid, User.tenant_id == tenant_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == UserRole.owner:
        other_owners = await _count_active_owners(tenant_id, db, exclude_user_id=user.id)
        if other_owners == 0:
            raise HTTPException(status_code=409, detail="Cannot remove the last owner")

    user.is_active = False
    await db.commit()


async def complete_first_login(*, user_id: str, new_password: str, db: AsyncSession) -> None:
    """Reset password for a user with must_change_password=True; clears the flag."""
    if len(new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    uid = _parse_uuid(user_id, "user_id")
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.must_change_password:
        raise HTTPException(status_code=400, detail="Password reset is not required for this account")

    # Defense against re-using the temp password
    if user.password_hash and verify_password(new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="New password must differ from the temporary password")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    await db.commit()
