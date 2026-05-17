"""Audit log read API — owner-only, tenant-scoped."""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.rbac import require_owner
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogOut, AuditLogListOut
from app.services import auth_service

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _to_out(row: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=str(row.id),
        actor_user_id=str(row.actor_user_id) if row.actor_user_id else None,
        actor_email=row.actor.email if row.actor else None,
        action=row.action,
        target_type=row.target_type,
        target_id=row.target_id,
        metadata=row.extra_metadata,
        ip_address=row.ip_address,
        user_agent=row.user_agent,
        created_at=row.created_at,
    )


@router.get("", response_model=AuditLogListOut)
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None),
    actor_id: str | None = Query(None),
    user_id: str = Depends(require_owner()),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    filters = [AuditLog.tenant_id == tenant.id]
    if action:
        filters.append(AuditLog.action == action)
    if actor_id:
        try:
            filters.append(AuditLog.actor_user_id == uuid.UUID(actor_id))
        except (ValueError, TypeError):
            # Invalid uuid → return no results rather than 422.
            filters.append(AuditLog.actor_user_id == uuid.UUID(int=0))

    total_q = await db.execute(select(func.count(AuditLog.id)).where(and_(*filters)))
    total = total_q.scalar() or 0

    result = await db.execute(
        select(AuditLog)
        .where(and_(*filters))
        .options(joinedload(AuditLog.actor))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    return AuditLogListOut(
        items=[_to_out(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
