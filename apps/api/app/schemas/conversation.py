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


class MessagesPage(BaseModel):
    """Cursor-paginated message response.

    ``next_cursor`` is the ID of the *oldest* message in the current batch.
    Pass it as ``?before=<next_cursor>`` to retrieve the next (older) page.
    ``has_more`` is False when the beginning of the conversation has been reached.
    """
    messages: list[MessageOut]
    has_more: bool
    next_cursor: str | None = None


class ConversationOut(BaseModel):
    id: uuid.UUID
    visitor_id: str
    page_url: str | None
    started_at: datetime
    last_message_at: datetime
    message_count: int = 0
    visitor_name: str | None = None
    visitor_email: str | None = None
    visitor_phone: str | None = None
    external_user_id: str | None = None
    mode: str = "ai"   # 'ai' | 'human'

    class Config:
        from_attributes = True


class AgentReplyIn(BaseModel):
    """Payload for a human agent sending a reply to a visitor."""
    message: str


class SetModeIn(BaseModel):
    """Payload for toggling a conversation between AI and human mode."""
    mode: str  # 'ai' | 'human'

