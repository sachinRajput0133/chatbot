import uuid
from sqlalchemy import Boolean, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class LeadCaptureConfig(Base):
    __tablename__ = "lead_capture_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    collect_name: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    collect_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    collect_phone: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    collect_address: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # list of {"question": str, "field": str, "required": bool}
    custom_questions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    skip_if_filled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trigger_after: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="lead_capture_config")
