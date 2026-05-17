"""Role CRUD — owner-only.

The permission registry endpoint is exposed here too (under /api/roles/permissions/registry)
so the frontend can render the role-edit checkbox grid dynamically.
"""
import uuid
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_owner
from app.core import permissions as perms_registry
from app.schemas.role import RoleCreate, RoleUpdate, RoleOut, PermissionRegistryOut
from app.services import role_service, auth_service, audit_service

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
    request: Request,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    actor, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await role_service.create_role(tenant.id, data, db)
    await audit_service.log(
        db,
        tenant_id=tenant.id,
        actor_user_id=actor.id,
        action="role.create",
        target_type="role",
        target_id=result.id,
        metadata={"name": result.name, "permissions": [p.model_dump() for p in result.permissions]},
        request=request,
    )
    await db.commit()
    return result


@router.patch("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: str,
    data: RoleUpdate,
    request: Request,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    actor, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await role_service.update_role(role_id, tenant.id, data, db)
    await audit_service.log(
        db,
        tenant_id=tenant.id,
        actor_user_id=actor.id,
        action="role.update",
        target_type="role",
        target_id=role_id,
        metadata=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    await db.commit()
    return result


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    request: Request,
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    actor, tenant = await auth_service.get_user_with_tenant(user_id, db)
    await role_service.delete_role(role_id, tenant.id, db)
    await audit_service.log(
        db,
        tenant_id=tenant.id,
        actor_user_id=actor.id,
        action="role.delete",
        target_type="role",
        target_id=role_id,
        request=request,
    )
    await db.commit()
