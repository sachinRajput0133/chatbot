import uuid
import secrets
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.tenant import Tenant
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate, ApiKeyOut, ApiKeyCreateOut
from app.services import auth_service

router = APIRouter(prefix="/api/api-keys", tags=["API Keys"])

def _generate_api_key() -> str:
    # Generate a random 32-byte key, encoded as hex (64 chars)
    # Prefix it with cb_ for easy identification (chatbot_api_key)
    return "cb_" + secrets.token_hex(32)

def _hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

@router.get("", response_model=list[ApiKeyOut])
async def list_api_keys(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    result = await db.execute(select(ApiKey).where(ApiKey.tenant_id == tenant.id).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()

@router.post("", response_model=ApiKeyCreateOut)
async def create_api_key(
    data: ApiKeyCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    raw_key = _generate_api_key()
    hashed_key = _hash_api_key(raw_key)
    prefix = raw_key[:7] + "..." + raw_key[-4:]

    api_key = ApiKey(
        tenant_id=tenant.id,
        name=data.name,
        key_hash=hashed_key,
        prefix=prefix
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    # Return the raw key ONLY once
    return {
        "id": api_key.id,
        "name": api_key.name,
        "prefix": api_key.prefix,
        "created_at": api_key.created_at,
        "last_used_at": api_key.last_used_at,
        "key": raw_key
    }

@router.delete("/{key_id}")
async def delete_api_key(
    key_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)

    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == tenant.id))
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    await db.delete(api_key)
    await db.commit()
    return {"status": "success"}
