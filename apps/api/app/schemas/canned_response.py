from datetime import datetime
from pydantic import BaseModel, Field


class CannedResponseIn(BaseModel):
    shortcut: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)


class CannedResponseUpdate(BaseModel):
    shortcut: str | None = Field(None, min_length=1, max_length=64)
    title: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = Field(None, min_length=1)


class CannedResponseOut(BaseModel):
    id: str
    shortcut: str
    title: str
    content: str
    created_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
