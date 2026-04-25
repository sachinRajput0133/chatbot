from pydantic import BaseModel, Field, field_validator, EmailStr


SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/services/"


class SlackIntegrationStatus(BaseModel):
    """Safe read-side view — never exposes the full URL."""
    configured: bool
    masked_url: str | None = None  # e.g. "hooks.slack.com/services/T01/…/abc1234"


class SetSlackWebhookRequest(BaseModel):
    webhook_url: str = Field(..., min_length=len(SLACK_WEBHOOK_PREFIX) + 10, max_length=300)

    @field_validator("webhook_url")
    @classmethod
    def _must_be_slack(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(SLACK_WEBHOOK_PREFIX):
            raise ValueError(
                f"webhook_url must start with {SLACK_WEBHOOK_PREFIX}"
            )
        return v


class TestSlackRequest(BaseModel):
    """Optional override — if omitted, tests the stored URL."""
    webhook_url: str | None = None


class TestSlackResponse(BaseModel):
    ok: bool
    detail: str | None = None


class TestEmailResponse(BaseModel):
    ok: bool
    sent_to: str
    cc_count: int
    detail: str | None = None


MAX_NOTIFICATION_EMAILS = 5


class NotificationEmailsConfig(BaseModel):
    """
    Read view. `primary_email` is the per-tenant override for the `to:` recipient
    (null means "use `account_email`"). `cc_emails` are extra addresses CC'd
    alongside. `account_email` is read-only; the UI surfaces it so the user
    knows the fallback.
    """
    primary_email: EmailStr | None = None
    cc_emails: list[EmailStr] = Field(default_factory=list, max_length=MAX_NOTIFICATION_EMAILS)
    account_email: EmailStr


class SetNotificationEmailsRequest(BaseModel):
    primary_email: EmailStr | None = None
    cc_emails: list[EmailStr] = Field(default_factory=list, max_length=MAX_NOTIFICATION_EMAILS)

    @field_validator("cc_emails")
    @classmethod
    def _dedupe_lowercase(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for e in v:
            key = e.lower()
            if key not in seen:
                seen.add(key)
                out.append(key)
        return out

    @field_validator("primary_email")
    @classmethod
    def _lowercase_primary(cls, v: str | None) -> str | None:
        return v.lower() if v else None


MAX_ALERT_KEYWORDS = 20


class AlertKeywordsConfig(BaseModel):
    """Read view for tenant alert keywords."""
    keywords: list[str] = Field(default_factory=list)
    max_keywords: int = MAX_ALERT_KEYWORDS


class SetAlertKeywordsRequest(BaseModel):
    keywords: list[str] = Field(default_factory=list)

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, v: list[str]) -> list[str]:
        # Normalize: lowercase, strip, deduplicate, remove empties
        cleaned = list(dict.fromkeys(
            kw.strip().lower() for kw in v if kw.strip()
        ))
        if len(cleaned) > MAX_ALERT_KEYWORDS:
            raise ValueError(f"Maximum {MAX_ALERT_KEYWORDS} alert keywords allowed")
        return cleaned


# ── WhatsApp ──────────────────────────────────────────────────────────────────

class WhatsAppIntegrationStatus(BaseModel):
    configured: bool
    masked_phone_id: str | None = None
    recipient_count: int = 0


class SetWhatsAppConfigRequest(BaseModel):
    phone_number_id: str = Field(..., min_length=5, max_length=100)
    access_token: str = Field(..., min_length=20, max_length=1000)


class SetWhatsAppRecipientsRequest(BaseModel):
    phones: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("phones")
    @classmethod
    def validate_phones(cls, v: list[str]) -> list[str]:
        import re
        # Basic E.164-ish validation: + followed by 7-15 digits
        cleaned = []
        for p in v:
            p = p.strip()
            if not p:
                continue
            if not re.match(r"^\+\d{7,15}$", p):
                raise ValueError(f"Invalid phone number format: {p}. Must be E.164 (e.g. +1234567890)")
            cleaned.append(p)
        return list(dict.fromkeys(cleaned)) # Deduplicate


class TestWhatsAppRequest(BaseModel):
    """Optional override — if omitted, tests the stored credentials."""
    phone_number_id: str | None = None
    access_token: str | None = None
    test_phone: str | None = None  # Optional number to test before saving recipients


class TestWhatsAppResponse(BaseModel):
    ok: bool
    detail: str | None = None
    delivered_to: int = 0


class WhatsAppRecipientsConfig(BaseModel):
    phones: list[str] = Field(default_factory=list)
    max_recipients: int = 5


# ── Zapier ────────────────────────────────────────────────────────────────────

class ZapierIntegrationStatus(BaseModel):
    configured: bool
    masked_url: str | None = None


class SetZapierWebhookRequest(BaseModel):
    webhook_url: str = Field(..., max_length=512)

    @field_validator("webhook_url")
    @classmethod
    def _must_be_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("http"):
            raise ValueError("webhook_url must be a valid URL")
        return v


class TestZapierRequest(BaseModel):
    webhook_url: str | None = None


class TestZapierResponse(BaseModel):
    ok: bool
    detail: str | None = None

