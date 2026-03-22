import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.widget import WidgetConfig
from app.models.tenant import Tenant
from app.schemas.widget import WidgetConfigOut, WidgetConfigUpdate
from app.services import auth_service

router = APIRouter(tags=["widget"])


@router.get("/api/widget-config/{bot_id}", response_model=WidgetConfigOut)
async def get_widget_config_public(bot_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public endpoint — used by widget.js to load bot appearance."""
    result = await db.execute(select(Tenant).where(Tenant.bot_id == bot_id, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Bot not found")

    result = await db.execute(select(WidgetConfig).where(WidgetConfig.tenant_id == tenant.id))
    config = result.scalar_one_or_none()
    if not config:
        # Return defaults
        return WidgetConfigOut(
            bot_name="Assistant",
            primary_color="#6366f1",
            welcome_message="Hi! How can I help you today?",
            position="bottom-right",
            avatar_url=None,
        )
    return config


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
