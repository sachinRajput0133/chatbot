from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class InviteUserRequest(BaseModel):
    email: EmailStr
    role_id: str  # UUID


class UpdateUserRequest(BaseModel):
    role_id: str | None = None
    is_active: bool | None = None


class UserAdminOut(BaseModel):
    id: str
    email: str
    role: str                 # system role: owner | member | staff
    role_id: str | None = None
    role_name: str | None = None
    must_change_password: bool = False
    is_active: bool = True
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class CompleteInvitationRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class InviteUserResponse(BaseModel):
    user: UserAdminOut
    invitation_email_sent: bool
