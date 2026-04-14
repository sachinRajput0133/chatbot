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
    tone_of_voice: str | None = None
    target_audience: str | None = None
    brand_values: str | None = None
    what_we_do: str | None = None
    unique_selling_proposition: str | None = None
    system_prompt: str | None = None
    suggested_questions: list[str] = []
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
    # Brand Voice
    company_website: str | None = None
    company_email: str | None = None
    company_address: str | None = None
    company_phone: str | None = None
    business_hours: str | None = None
    tone_of_voice: str | None = None
    target_audience: str | None = None
    brand_values: str | None = None
    what_we_do: str | None = None
    unique_selling_proposition: str | None = None
