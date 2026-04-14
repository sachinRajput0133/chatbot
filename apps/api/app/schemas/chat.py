import uuid
from pydantic import BaseModel


class VisitorInfo(BaseModel):
    user_id: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class ChatRequest(BaseModel):
    message: str
    visitor_id: str  # UUID stored in client localStorage
    conversation_id: uuid.UUID | None = None
    page_url: str | None = None
    user_info: VisitorInfo | None = None


class ChatResponse(BaseModel):
    reply: str
    message_id: uuid.UUID
    conversation_id: uuid.UUID
