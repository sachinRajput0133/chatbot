from fastapi import APIRouter
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant

router = APIRouter(prefix="/api/platform", tags=["platform"])


@router.get("/config")
async def platform_config():
    """Public endpoint — returns the platform help bot_id for the dashboard help widget."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Tenant).where(Tenant.email == settings.PLATFORM_ADMIN_EMAIL)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            return {"help_bot_id": None}
        return {"help_bot_id": str(tenant.bot_id)}
