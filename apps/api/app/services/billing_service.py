"""
Dual-gateway billing service.
India → Razorpay  |  International → Stripe
"""
import stripe
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.tenant import Tenant, Plan
from app.models.subscription import Subscription, SubscriptionStatus, PaymentGateway

stripe.api_key = settings.STRIPE_SECRET_KEY


def _get_razorpay_client():
    import razorpay  # lazy import — razorpay uses pkg_resources which may not be available
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

STRIPE_PRICE_IDS = {
    "starter": settings.STRIPE_STARTER_PRICE_ID,
    "growth": settings.STRIPE_GROWTH_PRICE_ID,
    "enterprise": settings.STRIPE_ENTERPRISE_PRICE_ID,
}

RAZORPAY_PLAN_IDS = {
    "starter": settings.RAZORPAY_STARTER_PLAN_ID,
    "growth": settings.RAZORPAY_GROWTH_PLAN_ID,
    "enterprise": settings.RAZORPAY_ENTERPRISE_PLAN_ID,
}

PLAN_ENUM_MAP = {
    "starter": Plan.starter,
    "growth": Plan.growth,
    "enterprise": Plan.enterprise,
}


async def create_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> tuple[str, str]:
    """Returns (checkout_url, gateway)."""
    if plan not in ("starter", "growth", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    if tenant.country == "IN":
        return await _razorpay_checkout(tenant, plan, db)
    else:
        return await _stripe_checkout(tenant, plan, db)


async def _stripe_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> tuple[str, str]:
    price_id = STRIPE_PRICE_IDS.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Stripe price not configured")

    # Get or create Stripe customer
    if not tenant.stripe_customer_id:
        customer = stripe.Customer.create(email=tenant.email, name=tenant.business_name)
        tenant.stripe_customer_id = customer.id
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=tenant.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/dashboard/billing?success=true",
        cancel_url=f"{settings.FRONTEND_URL}/dashboard/billing?cancelled=true",
        metadata={"tenant_id": str(tenant.id), "plan": plan},
    )
    return session.url, "stripe"


async def _razorpay_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> tuple[str, str]:
    plan_id = RAZORPAY_PLAN_IDS.get(plan)
    if not plan_id:
        raise HTTPException(status_code=400, detail="Razorpay plan not configured")

    razorpay_client = _get_razorpay_client()
    subscription = razorpay_client.subscription.create({
        "plan_id": plan_id,
        "customer_notify": 1,
        "total_count": 12,
        "notes": {"tenant_id": str(tenant.id), "plan": plan},
    })
    # Razorpay: redirect to payment page
    checkout_url = f"https://rzp.io/l/{subscription['id']}"
    return checkout_url, "razorpay"


async def handle_stripe_webhook(payload: bytes, sig_header: str, db: AsyncSession):
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "customer.subscription.created":
        await _on_stripe_sub_created(event["data"]["object"], db)
    elif event["type"] == "customer.subscription.updated":
        await _on_stripe_sub_updated(event["data"]["object"], db)
    elif event["type"] in ("customer.subscription.deleted",):
        await _on_stripe_sub_cancelled(event["data"]["object"], db)


async def _on_stripe_sub_created(sub_obj: dict, db: AsyncSession):
    tenant_id = sub_obj.get("metadata", {}).get("tenant_id")
    plan = sub_obj.get("metadata", {}).get("plan", "starter")
    if not tenant_id:
        return

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return

    tenant.plan = PLAN_ENUM_MAP.get(plan, Plan.starter)

    subscription = Subscription(
        tenant_id=tenant.id,
        gateway=PaymentGateway.stripe,
        gateway_subscription_id=sub_obj["id"],
        gateway_customer_id=sub_obj.get("customer"),
        plan=plan,
        status=SubscriptionStatus.active,
    )
    db.add(subscription)
    await db.commit()


async def _on_stripe_sub_updated(sub_obj: dict, db: AsyncSession):
    result = await db.execute(
        select(Subscription).where(Subscription.gateway_subscription_id == sub_obj["id"])
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = SubscriptionStatus.active if sub_obj["status"] == "active" else SubscriptionStatus.past_due
        await db.commit()


async def _on_stripe_sub_cancelled(sub_obj: dict, db: AsyncSession):
    result = await db.execute(
        select(Subscription).where(Subscription.gateway_subscription_id == sub_obj["id"])
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = SubscriptionStatus.cancelled
        result2 = await db.execute(select(Tenant).where(Tenant.id == sub.tenant_id))
        tenant = result2.scalar_one_or_none()
        if tenant:
            tenant.plan = Plan.free
        await db.commit()


async def handle_razorpay_webhook(payload: dict, db: AsyncSession):
    event = payload.get("event")
    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})

    tenant_id = entity.get("notes", {}).get("tenant_id")
    plan = entity.get("notes", {}).get("plan", "starter")
    sub_id = entity.get("id")

    if not tenant_id or not sub_id:
        return

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return

    if event == "subscription.activated":
        tenant.plan = PLAN_ENUM_MAP.get(plan, Plan.starter)
        subscription = Subscription(
            tenant_id=tenant.id,
            gateway=PaymentGateway.razorpay,
            gateway_subscription_id=sub_id,
            plan=plan,
            status=SubscriptionStatus.active,
        )
        db.add(subscription)
    elif event == "subscription.cancelled":
        result2 = await db.execute(
            select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
        )
        sub = result2.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.cancelled
        tenant.plan = Plan.free

    await db.commit()
