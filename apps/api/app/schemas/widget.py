from pydantic import BaseModel
from app.models.widget import WidgetPosition


class WidgetConfigOut(BaseModel):
    bot_name: str
    primary_color: str
    welcome_message: str
    position: WidgetPosition
    avatar_url: str | None

    class Config:
        from_attributes = True


class WidgetConfigUpdate(BaseModel):
    bot_name: str | None = None
    primary_color: str | None = None
    welcome_message: str | None = None
    position: WidgetPosition | None = None
    avatar_url: str | None = None
    system_prompt: str | None = None
