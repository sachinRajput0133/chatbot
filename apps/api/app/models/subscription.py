import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"
    past_due = "past_due"
    trialing = "trialing"


class PaymentGateway(str, enum.Enum):
    stripe = "stripe"
    razorpay = "razorpay"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    gateway: Mapped[PaymentGateway] = mapped_column(SAEnum(PaymentGateway), nullable=False)
    gateway_subscription_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    gateway_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(
        SAEnum(SubscriptionStatus), default=SubscriptionStatus.active, nullable=False
    )
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="subscription")
