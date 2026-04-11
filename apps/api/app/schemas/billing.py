from pydantic import BaseModel


class CreateCheckoutRequest(BaseModel):
    plan: str  # starter | growth | enterprise
    # gateway determined by tenant's country


class CheckoutResponse(BaseModel):
    gateway: str                    # stripe | razorpay
    checkout_url: str | None = None # Stripe only — redirect URL
    subscription_id: str | None = None  # Razorpay only — open modal with this
    key_id: str | None = None           # Razorpay only — publishable key


class SubscriptionOut(BaseModel):
    plan: str
    status: str
    gateway: str
    current_period_end: str | None

    class Config:
        from_attributes = True
