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

