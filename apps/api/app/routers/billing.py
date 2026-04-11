from fastapi import APIRouter, Depends, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.subscription import Subscription
from app.schemas.billing import CreateCheckoutRequest, CheckoutResponse, SubscriptionOut, VerifyRazorpayRequest
from app.services import auth_service, billing_service

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    data: CreateCheckoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await billing_service.create_checkout(tenant, data.plan, db)
    return CheckoutResponse(**result)


@router.get("/subscription", response_model=SubscriptionOut | None)
async def get_subscription(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    result = await db.execute(select(Subscription).where(Subscription.tenant_id == tenant.id))
    sub = result.scalar_one_or_none()
    if not sub:
        return None
    return SubscriptionOut(
        plan=sub.plan,
        status=sub.status,
        gateway=sub.gateway,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
    )


@router.post("/verify-razorpay")
async def verify_razorpay_payment(
    data: VerifyRazorpayRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    await billing_service.verify_and_activate_razorpay(tenant, data, db)
    return {"status": "ok", "plan": data.plan}


@router.post("/webhook/stripe", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    payload = await request.body()
    await billing_service.handle_stripe_webhook(payload, stripe_signature, db)
    return {"status": "ok"}


@router.post("/webhook/razorpay", include_in_schema=False)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="x-razorpay-signature"),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    await billing_service.handle_razorpay_webhook(body, x_razorpay_signature, db)
    return {"status": "ok"}
