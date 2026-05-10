"""Role CRUD — owner-only.

The permission registry endpoint is exposed here too (under /api/roles/permissions/registry)
so the frontend can render the role-edit checkbox grid dynamically.
"""
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_owner
from app.core import permissions as perms_registry
from app.schemas.role import RoleCreate, RoleUpdate, RoleOut, PermissionRegistryOut
from app.services import role_service, auth_service

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("/permissions/registry", response_model=PermissionRegistryOut)
async def get_permission_registry(_: str = Depends(require_owner())):
    return PermissionRegistryOut(modules=perms_registry.registry_dict())


@router.get("", response_model=list[RoleOut])
async def list_roles(
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return await role_service.list_roles(tenant.id, db)


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return await role_service.create_role(tenant.id, data, db)


@router.patch("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: str,
    data: RoleUpdate,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return await role_service.update_role(role_id, tenant.id, data, db)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    await role_service.delete_role(role_id, tenant.id, db)
