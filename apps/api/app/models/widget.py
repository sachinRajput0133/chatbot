import uuid
from sqlalchemy import String, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base


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

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="widget_config")
