from pydantic import BaseModel


class CustomQuestion(BaseModel):
    question: str
    field: str
    required: bool = False


class LeadCaptureConfigOut(BaseModel):
    enabled: bool
    collect_name: bool
    collect_email: bool
    collect_phone: bool
    collect_address: bool
    custom_questions: list[CustomQuestion]
    skip_if_filled: bool
    trigger_after: int

    class Config:
        from_attributes = True


class LeadCaptureConfigUpdate(BaseModel):
    enabled: bool | None = None
    collect_name: bool | None = None
    collect_email: bool | None = None
    collect_phone: bool | None = None
    collect_address: bool | None = None
    custom_questions: list[CustomQuestion] | None = None
    skip_if_filled: bool | None = None
    trigger_after: int | None = None
