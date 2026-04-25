import uuid
from datetime import datetime
from pydantic import BaseModel

class ApiKeyCreate(BaseModel):
    name: str

class ApiKeyOut(BaseModel):
    id: uuid.UUID
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None

    class Config:
        from_attributes = True

class ApiKeyCreateOut(ApiKeyOut):
    key: str  # The raw API key (only returned once upon creation)
