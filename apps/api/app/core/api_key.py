import hashlib
from fastapi import Security, HTTPException, Depends
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.api_key import ApiKey
from app.models.tenant import Tenant

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

async def get_tenant_from_api_key(
    api_key: str = Security(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> Tenant:
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")

    hashed_key = hash_api_key(api_key)
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == hashed_key))
    api_key_obj = result.scalar_one_or_none()

    if not api_key_obj:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    # Update last used timestamp
    api_key_obj.last_used_at = datetime.now(timezone.utc)
    await db.commit()

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == api_key_obj.tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    return tenant
