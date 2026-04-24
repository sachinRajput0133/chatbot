from pydantic import BaseModel, Field, field_validator


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
