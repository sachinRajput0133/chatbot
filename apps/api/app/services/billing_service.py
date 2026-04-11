"""
Dual-gateway billing service.
India → Razorpay  |  International → Stripe
"""
import hmac
import hashlib
from datetime import datetime, timezone
import stripe
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.tenant import Tenant, Plan
from app.models.subscription import Subscription, SubscriptionStatus, PaymentGateway
from app.services import email_service

PLAN_MESSAGE_LIMITS = {
    "starter": 1000,
    "growth": 10000,
    "enterprise": 999999,
}

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


def _stripe_configured() -> bool:
    key = settings.STRIPE_SECRET_KEY
    return bool(key) and not key.startswith("sk_test_...") and key != "sk_test_..."


def _razorpay_configured() -> bool:
    key = settings.RAZORPAY_KEY_ID
    return bool(key) and not key.startswith("rzp_test_...") and key != "rzp_test_..."


async def create_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> dict:
    """Returns a dict with gateway info.

    Stripe:   {"gateway": "stripe",   "checkout_url": "https://..."}
    Razorpay: {"gateway": "razorpay", "subscription_id": "sub_...", "key_id": "rzp_..."}

    Gateway selection:
    - India accounts → Razorpay (if configured) else Stripe
    - Other accounts → Stripe (if configured) else Razorpay
    - If neither is configured → raise clear error
    """
    if plan not in ("starter", "growth", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    prefer_razorpay = tenant.country == "IN"

    if prefer_razorpay:
        if _razorpay_configured():
            return await _razorpay_checkout(tenant, plan, db)
        elif _stripe_configured():
            return await _stripe_checkout(tenant, plan, db)
    else:
        if _stripe_configured():
            return await _stripe_checkout(tenant, plan, db)
        elif _razorpay_configured():
            return await _razorpay_checkout(tenant, plan, db)

    raise HTTPException(
        status_code=503,
        detail="Payment gateway not configured. Please set Stripe or Razorpay keys in your environment."
    )


async def _stripe_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> dict:
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
    return {"gateway": "stripe", "checkout_url": session.url}


async def _razorpay_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> dict:
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
    # Return subscription_id + key so frontend opens Razorpay checkout.js modal
    return {
        "gateway": "razorpay",
        "subscription_id": subscription["id"],
        "key_id": settings.RAZORPAY_KEY_ID,
    }


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

    email_service.send_plan_upgraded(
        to=tenant.email,
        business_name=tenant.business_name,
        plan=plan,
        messages_limit=PLAN_MESSAGE_LIMITS.get(plan, 1000),
    )


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
            email_service.send_plan_cancelled(
                to=tenant.email,
                business_name=tenant.business_name,
            )
        await db.commit()


async def cancel_subscription(tenant: Tenant, db: AsyncSession):
    """
    Cancel at period end — user keeps access until current period expires,
    no auto-deduction next month.
    """
    result = await db.execute(select(Subscription).where(Subscription.tenant_id == tenant.id))
    sub = result.scalar_one_or_none()
    if not sub or sub.status != SubscriptionStatus.active:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    if sub.gateway == PaymentGateway.razorpay:
        razorpay_client = _get_razorpay_client()
        try:
            # Fetch current state from Razorpay first
            rz_sub = razorpay_client.subscription.fetch(sub.gateway_subscription_id)
            rz_status = rz_sub.get("status", "")

            if rz_status in ("created", "authenticated"):
                # Not yet active — cancel immediately (no cycle to end)
                razorpay_client.subscription.cancel(sub.gateway_subscription_id, {})
            elif rz_status == "active":
                # Active — cancel at end of current billing cycle
                razorpay_client.subscription.cancel(
                    sub.gateway_subscription_id,
                    {"cancel_at_cycle_end": 1},
                )
            # If already cancelled/completed, skip the API call
        except Exception as e:
            # Log but don't block — mark cancelled in our DB regardless
            print(f"[billing] Razorpay cancel warning for {sub.gateway_subscription_id}: {e}")
    elif sub.gateway == PaymentGateway.stripe:
        stripe.Subscription.modify(
            sub.gateway_subscription_id,
            cancel_at_period_end=True,
        )

    sub.cancel_at_period_end = True
    await db.commit()


async def verify_and_activate_razorpay(tenant: Tenant, data, db: AsyncSession):
    """
    Called immediately after checkout.js handler fires.
    Verifies the Razorpay payment signature and activates the plan right away
    — no webhook needed (works on localhost too).
    Signature: HMAC-SHA256(payment_id + "|" + subscription_id, key_secret)
    """
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{data.payment_id}|{data.subscription_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, data.signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")

    plan = data.plan
    tenant.plan = PLAN_ENUM_MAP.get(plan, Plan.starter)

    # Fetch subscription details from Razorpay to get current_period_end
    razorpay_client = _get_razorpay_client()
    rz_sub = razorpay_client.subscription.fetch(data.subscription_id)
    # current_end is a Unix timestamp
    period_end = None
    if rz_sub.get("current_end"):
        period_end = datetime.fromtimestamp(rz_sub["current_end"], tz=timezone.utc)

    # Upsert subscription record — look up by tenant_id first (handles plan upgrades/downgrades
    # where a new subscription_id is created but the tenant already has a record)
    result = await db.execute(
        select(Subscription).where(Subscription.tenant_id == tenant.id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.gateway_subscription_id = data.subscription_id
        sub.gateway = PaymentGateway.razorpay
        sub.status = SubscriptionStatus.active
        sub.plan = plan
        sub.cancel_at_period_end = False
        if period_end:
            sub.current_period_end = period_end
    else:
        sub = Subscription(
            tenant_id=tenant.id,
            gateway=PaymentGateway.razorpay,
            gateway_subscription_id=data.subscription_id,
            plan=plan,
            status=SubscriptionStatus.active,
            current_period_end=period_end,
        )
        db.add(sub)

    await db.commit()

    email_service.send_plan_upgraded(
        to=tenant.email,
        business_name=tenant.business_name,
        plan=plan,
        messages_limit=PLAN_MESSAGE_LIMITS.get(plan, 1000),
    )


async def handle_razorpay_webhook(body: bytes, signature: str | None, db: AsyncSession):
    import json

    # Verify signature when secret is configured
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if secret and signature:
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature")

    payload = json.loads(body)
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

    if event in ("subscription.activated", "subscription.charged"):
        tenant.plan = PLAN_ENUM_MAP.get(plan, Plan.starter)

        # Upsert subscription record
        result2 = await db.execute(
            select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
        )
        sub = result2.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.active
            sub.plan = plan
        else:
            sub = Subscription(
                tenant_id=tenant.id,
                gateway=PaymentGateway.razorpay,
                gateway_subscription_id=sub_id,
                plan=plan,
                status=SubscriptionStatus.active,
            )
            db.add(sub)

        if event == "subscription.activated":
            email_service.send_plan_upgraded(
                to=tenant.email,
                business_name=tenant.business_name,
                plan=plan,
                messages_limit=PLAN_MESSAGE_LIMITS.get(plan, 1000),
            )

    elif event == "subscription.cancelled":
        result2 = await db.execute(
            select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
        )
        sub = result2.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.cancelled
        tenant.plan = Plan.free
        email_service.send_plan_cancelled(
            to=tenant.email,
            business_name=tenant.business_name,
        )

    await db.commit()
