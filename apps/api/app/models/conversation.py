import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"   # AI-generated reply
    agent = "agent"           # Human agent reply from dashboard


class WebConversation(Base):
    __tablename__ = "web_conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    visitor_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    page_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    visitor_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    visitor_email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    visitor_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    external_user_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="ai")  # 'ai' | 'human'

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="conversations")
    messages: Mapped[list["WebMessage"]] = relationship(
        "WebMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="WebMessage.created_at"
    )


class WebMessage(Base):
    __tablename__ = "web_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("web_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(SAEnum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    conversation: Mapped["WebConversation"] = relationship("WebConversation", back_populates="messages")
