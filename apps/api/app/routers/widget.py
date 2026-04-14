import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.widget import WidgetConfig
from app.models.lead_capture import LeadCaptureConfig
from app.models.tenant import Tenant
from app.schemas.widget import WidgetConfigOut, WidgetConfigUpdate, LeadCaptureInfo
from app.services import auth_service

router = APIRouter(tags=["widget"])


def _build_lead_capture_info(lc: LeadCaptureConfig | None) -> LeadCaptureInfo:
    if not lc or not lc.enabled:
        return LeadCaptureInfo(enabled=False)
    return LeadCaptureInfo(
        enabled=True,
        collect_name=lc.collect_name,
        collect_email=lc.collect_email,
        collect_phone=lc.collect_phone,
        collect_address=lc.collect_address,
    )


@router.get("/api/widget-config/{bot_id}", response_model=WidgetConfigOut)
async def get_widget_config_public(bot_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public endpoint — used by widget.js to load bot appearance."""
    result = await db.execute(select(Tenant).where(Tenant.bot_id == bot_id, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Bot not found")

    result = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
    config = result.scalar_one_or_none()

    # Fetch lead capture config (may not exist)
    lc_result = await db.execute(
        select(LeadCaptureConfig).where(LeadCaptureConfig.tenant_id == tenant.id)
    )
    lc = lc_result.scalar_one_or_none()
    lead_capture_info = _build_lead_capture_info(lc)

    if not config:
        return WidgetConfigOut(
            bot_name="Assistant",
            primary_color="#6366f1",
            welcome_message="Hi! How can I help you today?",
            position="bottom-right",
            avatar_url=None,
            lead_capture=lead_capture_info,
        )

    out = WidgetConfigOut.model_validate(config)
    out.lead_capture = lead_capture_info
    return out


@router.get("/api/widget/config", response_model=WidgetConfigOut)
async def get_my_widget_config(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Widget config not found")
    return config


@router.put("/api/widget/config", response_model=WidgetConfigOut)
async def update_widget_config(
    data: WidgetConfigUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
    config = result.scalar_one_or_none()
    if not config:
        config = WidgetConfig(tenant_id=tenant.id)
        db.add(config)

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)
    return config
