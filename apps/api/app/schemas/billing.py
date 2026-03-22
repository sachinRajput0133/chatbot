from pydantic import BaseModel


class CreateCheckoutRequest(BaseModel):
    plan: str  # starter | growth | enterprise
    # gateway determined by tenant's country


class CheckoutResponse(BaseModel):
    checkout_url: str
    gateway: str  # stripe | razorpay


class SubscriptionOut(BaseModel):
    plan: str
    status: str
    gateway: str
    current_period_end: str | None

    class Config:
        from_attributes = True
