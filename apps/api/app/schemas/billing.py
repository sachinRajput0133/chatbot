from pydantic import BaseModel


class CreateCheckoutRequest(BaseModel):
    plan: str  # starter | growth | enterprise
    # gateway determined by tenant's country


class CheckoutResponse(BaseModel):
    gateway: str                          # stripe | razorpay | dodo
    checkout_url: str | None = None       # Stripe only — redirect URL
    subscription_id: str | None = None    # Razorpay only — open modal with this
    key_id: str | None = None             # Razorpay only — publishable key
    payment_link: str | None = None       # Dodo only — redirect URL
    client_secret: str | None = None      # Dodo only — for embedded checkout


class VerifyRazorpayRequest(BaseModel):
    payment_id: str       # razorpay_payment_id from checkout handler
    subscription_id: str  # razorpay_subscription_id from checkout handler
    signature: str        # razorpay_signature from checkout handler
    plan: str             # starter | growth | enterprise


class VerifyDodoRequest(BaseModel):
    payment_id: str       # payment_id from Dodo redirect
    subscription_id: str  # subscription_id from Dodo
    plan: str             # starter | growth | enterprise


class SubscriptionOut(BaseModel):
    plan: str
    status: str
    gateway: str
    current_period_end: str | None
    cancel_at_period_end: bool = False

    class Config:
        from_attributes = True
