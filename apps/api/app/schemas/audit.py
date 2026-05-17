from datetime import datetime
from pydantic import BaseModel, Field


class AuditLogOut(BaseModel):
    id: str
    actor_user_id: str | None = None
    actor_email: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    metadata: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class AuditLogListOut(BaseModel):
    items: list[AuditLogOut] = Field(default_factory=list)
    total: int
    limit: int
    offset: int
