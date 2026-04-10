"""
auth_service.py — Authentication business logic.

Google ID token verification uses the `google-auth` library to verify tokens
locally using Google's public keys. This avoids outbound HTTP calls to tokeninfo
and correctly validates the `aud` (audience) claim against GOOGLE_CLIENT_ID.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.tenant import Tenant, Plan
from app.models.user import User, UserRole
from app.models.widget import WidgetConfig
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import SignupRequest, LoginRequest, GoogleAuthRequest, UpdateProfileRequest, ChangePasswordRequest
from app.core.config import settings
from app.services import email_service

# google-auth: verifies ID token locally using Google's cached public keys (no outbound HTTP call)
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

# Reuse a single Request object (it manages a persistent session internally)
_google_request = google_requests.Request()


def _get_google_user_info(credential: str) -> dict:
    """
    Verify and decode a Google ID token locally using the google-auth library.
    - Verifies signature using Google's public JWKS (cached, refreshed automatically)
    - Validates `aud` (audience) == GOOGLE_CLIENT_ID
    - Validates token expiry and issuer
    Raises HTTP 401 on any verification failure.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google login is not configured on the server. Set GOOGLE_CLIENT_ID.",
        )
    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential,
            _google_request,
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google credential: {exc}") from exc

    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    return idinfo


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
    # Verify Google credential locally — no outbound HTTP needed
    info = _get_google_user_info(data.credential)

    google_id = info.get("sub")
    email = info.get("email")
    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    is_new_user = False

    # Check existing user by Google ID
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        # Check existing user by email (e.g. previously registered with email+password)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            # Link Google ID to existing account
            user.google_id = google_id
        else:
            # New user — create tenant + user
            is_new_user = True
            tenant = Tenant(
                business_name=data.business_name or info.get("name", email.split("@")[0]),
                email=email,
                country=(data.country or "US").upper(),
                plan=Plan.free,
            )
            db.add(tenant)
            await db.flush()

            db.add(WidgetConfig(tenant_id=tenant.id))

            user = User(
                tenant_id=tenant.id,
                email=email,
                google_id=google_id,
                role=UserRole.owner,
            )
            db.add(user)

    await db.commit()
    await db.refresh(user)

    if is_new_user:
        result2 = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        new_tenant = result2.scalar_one_or_none()
        if new_tenant:
            email_service.send_welcome(
                to=new_tenant.email,
                business_name=new_tenant.business_name,
                bot_id=str(new_tenant.bot_id),
            )

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


async def update_profile(user_id: str, data: UpdateProfileRequest, db: AsyncSession) -> tuple[User, Tenant]:
    user, tenant = await get_user_with_tenant(user_id, db)

    if data.business_name is not None:
        tenant.business_name = data.business_name.strip()
    if data.country is not None:
        tenant.country = data.country.upper()

    await db.commit()
    await db.refresh(user)
    await db.refresh(tenant)
    return user, tenant


async def change_password(user_id: str, data: ChangePasswordRequest, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Google-only accounts have no password — cannot change via this flow
    if not user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="This account uses Google sign-in. Password change is not available.",
        )

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
