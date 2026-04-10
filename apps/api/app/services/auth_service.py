import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.models.tenant import Tenant, Plan
from app.models.user import User, UserRole
from app.models.widget import WidgetConfig
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.schemas.auth import SignupRequest, LoginRequest, GoogleAuthRequest
from app.services import email_service


async def signup(data: SignupRequest, db: AsyncSession) -> tuple[User, str]:
    # Check email not taken
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create tenant
    tenant = Tenant(
        business_name=data.business_name,
        email=data.email,
        country=data.country.upper(),
        plan=Plan.free,
    )
    db.add(tenant)
    await db.flush()

    # Create default widget config
    widget = WidgetConfig(tenant_id=tenant.id)
    db.add(widget)

    # Create owner user
    user = User(
        tenant_id=tenant.id,
        email=data.email,
        password_hash=hash_password(data.password),
        role=UserRole.owner,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    email_service.send_welcome(
        to=tenant.email,
        business_name=tenant.business_name,
        bot_id=str(tenant.bot_id),
    )

    token = create_access_token(str(user.id), {"tenant_id": str(tenant.id), "role": user.role})
    return user, token


async def login(data: LoginRequest, db: AsyncSession) -> tuple[User, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id), {"tenant_id": str(user.tenant_id), "role": user.role})
    return user, token


async def google_auth(data: GoogleAuthRequest, db: AsyncSession) -> tuple[User, str]:
    try:
        info = id_token.verify_oauth2_token(
            data.id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_id = info["sub"]
    email = info["email"]

    # Check existing user by Google ID
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        # Check existing user by email
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
        else:
            # New user — create tenant + user
            tenant = Tenant(
                business_name=data.business_name or info.get("name", email.split("@")[0]),
                email=email,
                country=data.country.upper(),
                plan=Plan.free,
            )
            db.add(tenant)
            await db.flush()

            widget = WidgetConfig(tenant_id=tenant.id)
            db.add(widget)

            user = User(
                tenant_id=tenant.id,
                email=email,
                google_id=google_id,
                role=UserRole.owner,
            )
            db.add(user)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), {"tenant_id": str(user.tenant_id), "role": user.role})
    return user, token


async def get_user_with_tenant(user_id: str, db: AsyncSession) -> tuple[User, Tenant]:
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return user, tenant
