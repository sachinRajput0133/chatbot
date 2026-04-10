from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    business_name: str
    email: EmailStr
    password: str
    country: str = "US"  # ISO 3166-1 alpha-2


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str              # Google ID token JWT (from GoogleLogin component)
    business_name: str | None = None
    country: str = "US"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    tenant_id: str

    class Config:
        from_attributes = True


class TenantOut(BaseModel):
    id: str
    business_name: str
    email: str
    bot_id: str
    plan: str
    country: str
    message_count_month: int

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserOut
    tenant: TenantOut
