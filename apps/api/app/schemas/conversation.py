import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.conversation import MessageRole


class MessageOut(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: uuid.UUID
    visitor_id: str
    page_url: str | None
    started_at: datetime
    last_message_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True
