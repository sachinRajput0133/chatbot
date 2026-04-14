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


def build_lead_collection_prompt(
    config: LeadCaptureConfig,
    *,
    known_name: str | None = None,
    known_email: str | None = None,
    known_phone: str | None = None,
    known_address: str | None = None,
) -> str:
    """Return a system prompt addon that instructs the bot to collect contact info.

    Fields that are already known (passed via the ``known_*`` kwargs) are skipped
    so the bot never asks for information the visitor already provided.
    """
    if not config.enabled:
        return ""

    fields = []
    if config.collect_name and not known_name:
        fields.append("full name")
    if config.collect_email and not known_email:
        fields.append("email address")
    if config.collect_phone and not known_phone:
        fields.append("phone number")
    if config.collect_address and not known_address:
        fields.append("mailing address")
    for q in (config.custom_questions or []):
        fields.append(q.get("question", ""))

    if not fields:
        return ""

    fields_str = ", ".join(fields)
    prompt = (
        f"\n\nLEAD COLLECTION: During this conversation, naturally collect the visitor's {fields_str}. "
        "Ask ONE piece of information at a time, woven naturally into helping them. "
        "Do not make it feel like a form — keep it conversational."
    )

    known_info = []
    if known_name:
        known_info.append(f"Name: {known_name}")
    if known_email:
        known_info.append(f"Email: {known_email}")
    if known_phone:
        known_info.append(f"Phone: {known_phone}")
    if known_address:
        known_info.append(f"Address: {known_address}")

    if known_info:
        info_str = "\n".join(known_info)
        prompt += f"\n\nVISITOR CONTEXT: You already know the following about the visitor:\n{info_str}\nUse this to personalize the conversation and DO NOT ask for these details again."

    return prompt


def extract_contact_info(text: str) -> dict:
    """Extract name, email, phone from a message using simple regex patterns."""
    info: dict[str, str] = {}

    # Email
    email_match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if email_match:
        info["email"] = email_match.group(0)

    # Phone
    phone_match = re.search(r"(\+?\d[\d\s\-().]{7,}\d)", text)
    if phone_match:
        candidate = re.sub(r"[\s\-().]", "", phone_match.group(0))
        if 7 <= len(candidate) <= 15:
            info["phone"] = phone_match.group(0).strip()

    # Name — match common patterns like "my name is X", "I'm X", "I am X", "call me X"
    filler = {
        "me", "you", "here", "there", "sure", "ok", "okay", "back", "yes", "no",
        "hi", "hey", "hello", "thanks", "thank", "please", "sorry",
    }
    name_match = re.search(
        r"(?:my name is|i am|i'm|call me|this is|name is)\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+){0,2})",
        text,
        re.IGNORECASE,
    )
    if name_match:
        name = name_match.group(1).strip()
        if 2 <= len(name) <= 50 and name.lower() not in filler:
            info["name"] = name
    # Fallback: if the whole message looks like a plain name (1-3 words, capitalised,
    # no punctuation, no digits) treat it as a name response
    if "name" not in info and not info.get("email") and not info.get("phone"):
        plain = text.strip()
        if re.fullmatch(r"[A-Za-z]+(?:\s+[A-Za-z]+){0,2}", plain):
            words = plain.split()
            if all(len(w) >= 2 for w in words) and plain.lower() not in filler:
                info["name"] = plain.title()

    return info
