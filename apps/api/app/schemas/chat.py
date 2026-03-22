import uuid
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    visitor_id: str  # UUID stored in client localStorage
    conversation_id: uuid.UUID | None = None
    page_url: str | None = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: uuid.UUID
