from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path

# .env is at the repo root (two levels up from this file)
ENV_FILE = Path(__file__).parent.parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # AI
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str

    # Stripe (International)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_STARTER_PRICE_ID: str = ""
    STRIPE_GROWTH_PRICE_ID: str = ""
    STRIPE_ENTERPRISE_PRICE_ID: str = ""

    # Razorpay (India)
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    RAZORPAY_STARTER_PLAN_ID: str = ""
    RAZORPAY_GROWTH_PLAN_ID: str = ""
    RAZORPAY_ENTERPRISE_PLAN_ID: str = ""

    # Email
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@chatbot.com"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Storage
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = str(ENV_FILE)
        extra = "ignore"


settings = Settings()
