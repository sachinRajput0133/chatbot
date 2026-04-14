import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base


class Plan(str, enum.Enum):
    free = "free"
    starter = "starter"
    growth = "growth"
    enterprise = "enterprise"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="US")  # ISO 3166-1 alpha-2
    bot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4, index=True)
    plan: Mapped[Plan] = mapped_column(SAEnum(Plan), default=Plan.free, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    message_count_month: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message_count_reset_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # Stripe (international)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Razorpay (India)
    razorpay_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    knowledge_documents: Mapped[list["KnowledgeDocument"]] = relationship(
        "KnowledgeDocument", back_populates="tenant", cascade="all, delete-orphan"
    )
    widget_config: Mapped["WidgetConfig | None"] = relationship(
        "WidgetConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )
    conversations: Mapped[list["WebConversation"]] = relationship(
        "WebConversation", back_populates="tenant", cascade="all, delete-orphan"
    )
    subscription: Mapped["Subscription | None"] = relationship(
        "Subscription", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )
    lead_capture_config: Mapped["LeadCaptureConfig | None"] = relationship(
        "LeadCaptureConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )
