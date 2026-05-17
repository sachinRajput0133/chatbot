"""Canned response (quick-reply template) CRUD — tenant-scoped."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.canned_response import CannedResponse
from app.schemas.canned_response import (
    CannedResponseIn,
    CannedResponseOut,
    CannedResponseUpdate,
)
from app.services import auth_service

router = APIRouter(prefix="/api/canned-responses", tags=["canned-responses"])


def _to_out(row: CannedResponse) -> CannedResponseOut:
    return CannedResponseOut(
        id=str(row.id),
        shortcut=row.shortcut,
        title=row.title,
        content=row.content,
        created_by_user_id=str(row.created_by_user_id) if row.created_by_user_id else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _normalize_shortcut(s: str) -> str:
    # Strip leading slashes and whitespace; lowercase for stable matching.
    return s.strip().lstrip("/").lower()


@router.get("", response_model=list[CannedResponseOut])
async def list_canned_responses(
    user_id: str = Depends(require_permission("conversations", "view")),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(CannedResponse)
        .where(CannedResponse.tenant_id == tenant.id)
        .order_by(CannedResponse.shortcut.asc())
    )
    return [_to_out(r) for r in result.scalars().all()]


@router.post("", response_model=CannedResponseOut, status_code=201)
async def create_canned_response(
    payload: CannedResponseIn,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    user, tenant = await auth_service.get_user_with_tenant(user_id, db)
    row = CannedResponse(
        tenant_id=tenant.id,
        shortcut=_normalize_shortcut(payload.shortcut),
        title=payload.title.strip(),
        content=payload.content,
        created_by_user_id=user.id,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Shortcut already exists")
    await db.refresh(row)
    return _to_out(row)


@router.put("/{cr_id}", response_model=CannedResponseOut)
async def update_canned_response(
    cr_id: uuid.UUID,
    payload: CannedResponseUpdate,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(CannedResponse).where(
            CannedResponse.id == cr_id,
            CannedResponse.tenant_id == tenant.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Canned response not found")

    if payload.shortcut is not None:
        row.shortcut = _normalize_shortcut(payload.shortcut)
    if payload.title is not None:
        row.title = payload.title.strip()
    if payload.content is not None:
        row.content = payload.content

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Shortcut already exists")
    await db.refresh(row)
    return _to_out(row)


@router.delete("/{cr_id}", status_code=204)
async def delete_canned_response(
    cr_id: uuid.UUID,
    user_id: str = Depends(require_permission("conversations", "edit")),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(
        select(CannedResponse).where(
            CannedResponse.id == cr_id,
            CannedResponse.tenant_id == tenant.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Canned response not found")
    await db.delete(row)
    await db.commit()
    return None
