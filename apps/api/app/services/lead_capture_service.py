"""
Lead capture service: get/upsert config, build system prompt addon, extract contact info.
"""
import re
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.lead_capture import LeadCaptureConfig


async def get_config(tenant_id: uuid.UUID, db: AsyncSession) -> LeadCaptureConfig | None:
    result = await db.execute(
        select(LeadCaptureConfig).where(LeadCaptureConfig.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def upsert_config(tenant_id: uuid.UUID, updates: dict, db: AsyncSession) -> LeadCaptureConfig:
    config = await get_config(tenant_id, db)
    if config is None:
        config = LeadCaptureConfig(tenant_id=tenant_id)
        db.add(config)

    for key, value in updates.items():
        if value is not None:
            setattr(config, key, value)

    await db.commit()
    await db.refresh(config)
    return config


def build_lead_collection_prompt(config: LeadCaptureConfig) -> str:
    """Return a system prompt addon that instructs the bot to collect contact info."""
    if not config.enabled:
        return ""

    fields = []
    if config.collect_name:
        fields.append("full name")
    if config.collect_email:
        fields.append("email address")
    if config.collect_phone:
        fields.append("phone number")
    if config.collect_address:
        fields.append("mailing address")
    for q in (config.custom_questions or []):
        fields.append(q.get("question", ""))

    if not fields:
        return ""

    fields_str = ", ".join(fields)
    skip_note = " If the visitor has already provided some of this information, do not ask again." if config.skip_if_filled else ""
    return (
        f"\n\nLEAD COLLECTION: During this conversation, naturally collect the visitor's {fields_str}. "
        f"Ask ONE piece of information at a time, woven naturally into helping them.{skip_note} "
        "Do not make it feel like a form — keep it conversational."
    )


def extract_contact_info(text: str) -> dict:
    """Extract name, email, phone from a message using simple regex patterns."""
    info: dict[str, str] = {}

    email_match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if email_match:
        info["email"] = email_match.group(0)

    phone_match = re.search(r"(\+?\d[\d\s\-().]{7,}\d)", text)
    if phone_match:
        candidate = re.sub(r"[\s\-().]", "", phone_match.group(0))
        if 7 <= len(candidate) <= 15:
            info["phone"] = phone_match.group(0).strip()

    return info
