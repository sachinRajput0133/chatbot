from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.lead_capture import LeadCaptureConfigOut, LeadCaptureConfigUpdate
from app.services import auth_service, lead_capture_service

router = APIRouter(prefix="/api/lead-capture", tags=["lead-capture"])


async def _get_tenant(user_id: str, db: AsyncSession):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return tenant


@router.get("/config", response_model=LeadCaptureConfigOut)
async def get_lead_config(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    config = await lead_capture_service.get_config(tenant.id, db)
    if config is None:
        # No row yet — return defaults without persisting
        return LeadCaptureConfigOut(
            enabled=False,
            collect_name=True,
            collect_email=True,
            collect_phone=False,
            collect_address=False,
            custom_questions=[],
            skip_if_filled=True,
            trigger_after=1,
        )
    return config


@router.put("/config", response_model=LeadCaptureConfigOut)
async def update_lead_config(
    data: LeadCaptureConfigUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    return await lead_capture_service.upsert_config(tenant.id, updates, db)
