from pydantic import BaseModel
from app.models.widget import WidgetPosition


class LeadCaptureInfo(BaseModel):
    """Lead capture config embedded in widget-config response (public endpoint)."""
    enabled: bool = False
    collect_name: bool = True
    collect_email: bool = True
    collect_phone: bool = False
    collect_address: bool = False
    title: str = "Before we start..."
    subtitle: str = "Please share your details so we can help you better."


class WidgetConfigOut(BaseModel):
    bot_name: str
    primary_color: str
    welcome_message: str
    position: WidgetPosition
    avatar_url: str | None
    # Brand Voice
    company_website: str | None = None
    company_email: str | None = None
    company_address: str | None = None
    company_phone: str | None = None
    business_hours: str | None = None
    enforce_business_hours: bool = False
    tone_of_voice: str | None = None
    target_audience: str | None = None
    brand_values: str | None = None
    what_we_do: str | None = None
    unique_selling_proposition: str | None = None
    system_prompt: str | None = None
    suggested_questions: list[str] = []
    default_language: str | None = "en"
    calendly_url: str | None = None
    proactive_message: str | None = None
    proactive_delay: int | None = None
    proactive_exit_intent: bool = False
    ai_provider: str = "openai"
    ai_model: str = "gpt-4o-mini"
    email_followup_enabled: bool = True
    email_followup_subject: str | None = None
    theme: str = "light"
    # URL-based widget targeting
    url_targeting_mode: str = "all"
    url_targeting_patterns: list[str] = []
    # B3 — Confidence-based handoff
    confidence_threshold: float = 0.5
    auto_handoff_enabled: bool = False
    # Lead capture (included so widget knows what form to show)
    lead_capture: LeadCaptureInfo = LeadCaptureInfo()

    class Config:
        from_attributes = True


class WidgetConfigUpdate(BaseModel):
    bot_name: str | None = None
    primary_color: str | None = None
    welcome_message: str | None = None
    position: WidgetPosition | None = None
    avatar_url: str | None = None
    system_prompt: str | None = None
    suggested_questions: list[str] | None = None
    default_language: str | None = None
    calendly_url: str | None = None
    proactive_message: str | None = None
    proactive_delay: int | None = None
    proactive_exit_intent: bool | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    email_followup_enabled: bool | None = None
    email_followup_subject: str | None = None
    theme: str | None = None
    # URL-based widget targeting
    url_targeting_mode: str | None = None
    url_targeting_patterns: list[str] | None = None
    # B3 — Confidence-based handoff
    confidence_threshold: float | None = None
    auto_handoff_enabled: bool | None = None
    # Brand Voice
    company_website: str | None = None
    company_email: str | None = None
    company_address: str | None = None
    company_phone: str | None = None
    business_hours: str | None = None
    enforce_business_hours: bool | None = None
    tone_of_voice: str | None = None
    target_audience: str | None = None
    brand_values: str | None = None
    what_we_do: str | None = None
    unique_selling_proposition: str | None = None
