from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.core.rbac import get_user_permissions_list
from app.models.user import User
from app.schemas.auth import (
    SignupRequest, LoginRequest, GoogleAuthRequest,
    TokenResponse, MeResponse, UserOut, TenantOut,
    UpdateProfileRequest, UpdateProfileResponse, ChangePasswordRequest,
    CompleteInvitationRequest,
)
from app.services import auth_service, user_admin_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def _user_out(user: User, permissions: list[str]) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        tenant_id=str(user.tenant_id),
        is_google_user=bool(user.google_id),
        created_at=user.created_at,
        role_id=str(user.role_id) if user.role_id else None,
        role_name=user.role_obj.name if getattr(user, "role_obj", None) else None,
        must_change_password=user.must_change_password,
        permissions=permissions,
    )


def _tenant_out(tenant) -> TenantOut:
    return TenantOut(
        id=str(tenant.id),
        business_name=tenant.business_name,
        email=tenant.email,
        bot_id=str(tenant.bot_id),
        plan=tenant.plan,
        country=tenant.country,
        message_count_month=tenant.message_count_month,
        created_at=tenant.created_at,
    )


@router.post("/signup", response_model=TokenResponse)
@limiter.limit("10/minute")
async def signup(request: Request, data: SignupRequest, db: AsyncSession = Depends(get_db)):
    _, token = await auth_service.signup(data, db)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    _, token = await auth_service.login(data, db)
    return TokenResponse(access_token=token)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_auth(request: Request, data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    _, token = await auth_service.google_auth(data, db)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Fetch user with role relationship eager-loaded so we can return role_name.
    import uuid as _uuid
    result = await db.execute(
        select(User).where(User.id == _uuid.UUID(user_id)).options(selectinload(User.role_obj))
    )
    user = result.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    permissions = await get_user_permissions_list(user_id, db)

    return MeResponse(user=_user_out(user, permissions), tenant=_tenant_out(tenant))


@router.put("/profile", response_model=UpdateProfileResponse)
async def update_profile(
    data: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user, tenant = await auth_service.update_profile(user_id, data, db)
    permissions = await get_user_permissions_list(user_id, db)
    return UpdateProfileResponse(user=_user_out(user, permissions), tenant=_tenant_out(tenant))


@router.put("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.change_password(user_id, data, db)


@router.post("/complete-invitation", status_code=204)
async def complete_invitation(
    data: CompleteInvitationRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Set the password and clear must_change_password for an invited user."""
    await user_admin_service.complete_first_login(
        user_id=user_id, new_password=data.new_password, db=db
    )
