"""Tenant user management — invite, update role, deactivate. Owner-only."""
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_owner
from app.schemas.user_admin import (
    InviteUserRequest, UpdateUserRequest, UserAdminOut, InviteUserResponse,
)
from app.services import user_admin_service, auth_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserAdminOut])
async def list_users(
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return await user_admin_service.list_users(tenant.id, db)


@router.post("/invite", response_model=InviteUserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    data: InviteUserRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    actor, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return await user_admin_service.invite_user(
        tenant_id=tenant.id,
        inviter_id=actor.id,
        data=data,
        db=db,
        background_tasks=background_tasks,
    )


@router.patch("/{target_user_id}", response_model=UserAdminOut)
async def update_user(
    target_user_id: str,
    data: UpdateUserRequest,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    actor, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return await user_admin_service.update_user(
        user_id=target_user_id,
        tenant_id=tenant.id,
        actor_id=actor.id,
        data=data,
        db=db,
    )


@router.delete("/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    target_user_id: str,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    actor, tenant = await auth_service.get_user_with_tenant(user_id, db)
    await user_admin_service.delete_user(
        user_id=target_user_id,
        tenant_id=tenant.id,
        actor_id=actor.id,
        db=db,
    )
