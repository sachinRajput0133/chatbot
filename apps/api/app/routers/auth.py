from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.auth import (
    SignupRequest, LoginRequest, GoogleAuthRequest,
    TokenResponse, MeResponse, UserOut, TenantOut,
    UpdateProfileRequest, UpdateProfileResponse, ChangePasswordRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    _, token = await auth_service.signup(data, db)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    _, token = await auth_service.login(data, db)
    return TokenResponse(access_token=token)


@router.post("/google", response_model=TokenResponse)
async def google_auth(data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    _, token = await auth_service.google_auth(data, db)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return MeResponse(
        user=UserOut(
            id=str(user.id),
            email=user.email,
            role=user.role,
            tenant_id=str(user.tenant_id),
            is_google_user=bool(user.google_id),
            created_at=user.created_at,
        ),
        tenant=TenantOut(
            id=str(tenant.id),
            business_name=tenant.business_name,
            email=tenant.email,
            bot_id=str(tenant.bot_id),
            plan=tenant.plan,
            country=tenant.country,
            message_count_month=tenant.message_count_month,
            created_at=tenant.created_at,
        ),
    )


@router.put("/profile", response_model=UpdateProfileResponse)
async def update_profile(
    data: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user, tenant = await auth_service.update_profile(user_id, data, db)
    return UpdateProfileResponse(
        user=UserOut(
            id=str(user.id),
            email=user.email,
            role=user.role,
            tenant_id=str(user.tenant_id),
            is_google_user=bool(user.google_id),
            created_at=user.created_at,
        ),
        tenant=TenantOut(
            id=str(tenant.id),
            business_name=tenant.business_name,
            email=tenant.email,
            bot_id=str(tenant.bot_id),
            plan=tenant.plan,
            country=tenant.country,
            message_count_month=tenant.message_count_month,
            created_at=tenant.created_at,
        ),
    )


@router.put("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.change_password(user_id, data, db)
