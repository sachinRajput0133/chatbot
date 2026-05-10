"""Role / RolePermission CRUD with tenant isolation."""
import uuid
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.core import permissions as perms_registry
from app.models.role import Role, RolePermission
from app.models.user import User
from app.schemas.role import RoleCreate, RoleUpdate, RoleOut, RolePermissionEntry


# ── Internal helpers ──────────────────────────────────────────────────────────

def _to_out(role: Role, user_count: int) -> RoleOut:
    return RoleOut(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=[
            RolePermissionEntry(module=p.module, action=p.action) for p in role.permissions
        ],
        user_count=user_count,
        created_at=role.created_at,
    )


def _dedupe_permissions(entries: list[RolePermissionEntry]) -> list[tuple[str, str]]:
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for e in entries:
        key = (e.module, e.action)
        if key in seen:
            continue
        if not perms_registry.is_valid(e.module, e.action):
            raise HTTPException(status_code=422, detail=f"Invalid permission {e.module}:{e.action}")
        seen.add(key)
        out.append(key)
    return out


def _parse_uuid(value: str, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"Invalid {field}")


# ── Public API ────────────────────────────────────────────────────────────────

async def list_roles(tenant_id: uuid.UUID, db: AsyncSession) -> list[RoleOut]:
    # Fetch roles with permissions eagerly, then user_count via grouped subquery.
    user_count_q = (
        select(User.role_id, func.count(User.id).label("cnt"))
        .where(and_(User.tenant_id == tenant_id, User.is_active.is_(True)))
        .group_by(User.role_id)
    )
    counts_result = await db.execute(user_count_q)
    counts: dict[uuid.UUID, int] = {row.role_id: row.cnt for row in counts_result if row.role_id is not None}

    result = await db.execute(
        select(Role)
        .where(Role.tenant_id == tenant_id)
        .options(selectinload(Role.permissions))
        .order_by(Role.is_system.desc(), Role.created_at.asc())
    )
    roles = result.scalars().all()
    return [_to_out(r, counts.get(r.id, 0)) for r in roles]


async def get_role(role_id: str, tenant_id: uuid.UUID, db: AsyncSession) -> Role:
    rid = _parse_uuid(role_id, "role_id")
    result = await db.execute(
        select(Role)
        .where(and_(Role.id == rid, Role.tenant_id == tenant_id))
        .options(selectinload(Role.permissions))
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


async def create_role(tenant_id: uuid.UUID, data: RoleCreate, db: AsyncSession) -> RoleOut:
    name = data.name.strip()
    # Check duplicate name within the tenant
    existing = await db.execute(
        select(Role).where(and_(Role.tenant_id == tenant_id, Role.name == name))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A role with this name already exists")

    pairs = _dedupe_permissions(data.permissions)

    role = Role(
        tenant_id=tenant_id,
        name=name,
        description=(data.description or None),
        is_system=False,
    )
    db.add(role)
    await db.flush()

    for module, action in pairs:
        db.add(RolePermission(role_id=role.id, module=module, action=action))

    await db.commit()
    # Reload with permissions
    fresh = await get_role(str(role.id), tenant_id, db)
    return _to_out(fresh, 0)


async def update_role(role_id: str, tenant_id: uuid.UUID, data: RoleUpdate, db: AsyncSession) -> RoleOut:
    role = await get_role(role_id, tenant_id, db)

    if data.name is not None:
        new_name = data.name.strip()
        if role.is_system and new_name != role.name:
            raise HTTPException(status_code=400, detail="System roles cannot be renamed")
        if new_name != role.name:
            dup = await db.execute(
                select(Role.id).where(and_(
                    Role.tenant_id == tenant_id,
                    Role.name == new_name,
                    Role.id != role.id,
                ))
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="A role with this name already exists")
        role.name = new_name

    if data.description is not None:
        role.description = data.description.strip() or None

    if data.permissions is not None:
        if role.is_system:
            raise HTTPException(status_code=400, detail="System role permissions cannot be changed")
        pairs = _dedupe_permissions(data.permissions)
        # Atomic replace: delete existing, insert new — same transaction.
        for existing_perm in list(role.permissions):
            await db.delete(existing_perm)
        await db.flush()
        for module, action in pairs:
            db.add(RolePermission(role_id=role.id, module=module, action=action))

    await db.commit()
    fresh = await get_role(role_id, tenant_id, db)

    user_count_q = await db.execute(
        select(func.count(User.id)).where(and_(User.role_id == fresh.id, User.is_active.is_(True)))
    )
    return _to_out(fresh, user_count_q.scalar() or 0)


async def delete_role(role_id: str, tenant_id: uuid.UUID, db: AsyncSession) -> None:
    role = await get_role(role_id, tenant_id, db)
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")

    in_use = await db.execute(
        select(func.count(User.id)).where(and_(User.role_id == role.id, User.is_active.is_(True)))
    )
    count = in_use.scalar() or 0
    if count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete role: {count} active user(s) still assigned to it",
        )

    await db.delete(role)
    await db.commit()


async def seed_default_roles(tenant_id: uuid.UUID, db: AsyncSession) -> Role:
    """Idempotent: seeds 'Owner' (system, all perms) and 'Read-only' for a tenant.

    Called from auth_service.signup / google_auth on tenant creation.
    Returns the Owner role for callers that may want its id.
    """
    existing = await db.execute(
        select(Role).where(and_(Role.tenant_id == tenant_id, Role.is_system.is_(True), Role.name == "Owner"))
    )
    owner_role = existing.scalar_one_or_none()
    if owner_role:
        return owner_role

    owner_role = Role(
        tenant_id=tenant_id,
        name="Owner",
        description="Full access to all modules. Cannot be edited or deleted.",
        is_system=True,
    )
    db.add(owner_role)
    await db.flush()
    for module, action in perms_registry.all_pairs():
        db.add(RolePermission(role_id=owner_role.id, module=module, action=action))

    readonly = Role(
        tenant_id=tenant_id,
        name="Read-only",
        description="View-only access to every module. Cannot create, edit, or delete.",
        is_system=False,
    )
    db.add(readonly)
    await db.flush()
    for module, actions in perms_registry.MODULES.items():
        if "view" in actions:
            db.add(RolePermission(role_id=readonly.id, module=module, action="view"))

    await db.flush()
    return owner_role
