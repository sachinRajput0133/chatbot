import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.conversation import MessageRole


class CitationOut(BaseModel):
    document_id: uuid.UUID
    title: str
    type: str | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime
    is_internal: bool = False
    citations: list[CitationOut] | None = None
    feedback_rating: int | None = None
    feedback_comment: str | None = None

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
    visitor_address: str | None = None
    external_user_id: str | None = None
    mode: str = "ai"   # 'ai' | 'human'
    status: str = "open"   # 'open' | 'pending' | 'resolved' | 'closed'
    resolved_at: datetime | None = None
    resolved_by_user_id: uuid.UUID | None = None
    last_read_at: datetime | None = None
    is_unread: bool = False
    unread_count: int = 0
    tags: list[str] = []
    assigned_user_id: uuid.UUID | None = None
    assigned_user_email: str | None = None
    assigned_at: datetime | None = None
    lead_score: int = 0
    lead_score_factors: dict[str, int] | None = None

    class Config:
        from_attributes = True


class AssignConversationIn(BaseModel):
    """Payload for assigning a conversation to a tenant member (or clearing)."""
    user_id: str | None = None


class UpdateTagsIn(BaseModel):
    tags: list[str]



class AgentReplyIn(BaseModel):
    """Payload for a human agent sending a reply to a visitor."""
    message: str


class InternalNoteIn(BaseModel):
    """Payload for an agent-only internal note (never shown to visitors)."""
    content: str


class SetModeIn(BaseModel):
    """Payload for toggling a conversation between AI and human mode."""
    mode: str  # 'ai' | 'human'


class SetStatusIn(BaseModel):
    """Payload for transitioning conversation status."""
    status: str  # 'open' | 'pending' | 'resolved' | 'closed'

