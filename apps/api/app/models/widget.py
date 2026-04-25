import uuid
from sqlalchemy import String, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID
import enum
from typing import TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class WidgetPosition(str, enum.Enum):
    bottom_right = "bottom-right"
    bottom_left = "bottom-left"


class WidgetConfig(Base):
    __tablename__ = "widget_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    bot_name: Mapped[str] = mapped_column(String(100), default="Assistant", nullable=False)
    primary_color: Mapped[str] = mapped_column(String(7), default="#6366f1", nullable=False)
    welcome_message: Mapped[str] = mapped_column(
        Text, default="Hi! How can I help you today?", nullable=False
    )
    position: Mapped[WidgetPosition] = mapped_column(
        SAEnum(WidgetPosition), default=WidgetPosition.bottom_right, nullable=False
    )
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Optional: system prompt override per tenant
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_questions: Mapped[list[str]] = mapped_column(
        postgresql.ARRAY(String), nullable=False, default=list, server_default="{}"
    )
    calendly_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Proactive Chat Triggers
    proactive_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proactive_delay: Mapped[int | None] = mapped_column(postgresql.INTEGER, nullable=True)
    proactive_exit_intent: Mapped[bool] = mapped_column(postgresql.BOOLEAN, nullable=False, default=False, server_default="false")

    # AI Model Selection
    ai_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="openai", server_default="'openai'")
    ai_model: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-4o-mini", server_default="'gpt-4o-mini'")

    # Conversation Continuity
    email_followup_enabled: Mapped[bool] = mapped_column(postgresql.BOOLEAN, nullable=False, default=True, server_default="true")
    email_followup_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Styling
    theme: Mapped[str] = mapped_column(String(20), nullable=False, default="light", server_default="'light'")

    # Brand Voice fields — used to auto-generate system prompt when system_prompt is blank
    company_website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    company_email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    company_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    business_hours: Mapped[str | None] = mapped_column(String(512), nullable=True)
    tone_of_voice: Mapped[str | None] = mapped_column(String(128), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    what_we_do: Mapped[str | None] = mapped_column(Text, nullable=True)
    unique_selling_proposition: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="widget_config")
