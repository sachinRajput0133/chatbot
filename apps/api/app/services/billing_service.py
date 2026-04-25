"""
Multi-gateway billing service.

Gateway selection is controlled by PAYMENT_GATEWAY env var:
  - "razorpay" (default): India tenants → Razorpay, others → Stripe
  - "dodo":               All tenants → Dodo Payments (global)

Dodo Payments API docs: https://docs.dodopayments.com
"""
import hmac
import hashlib
import json
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
    import razorpay  # lazy import — razorpay uses pkg_resources
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def _get_dodo_client():
    """Return a lightweight Dodo HTTP client (dodopayments SDK or raw httpx)."""
    try:
        import dodopayments  # official SDK if installed
        return dodopayments.DodoPayments(api_key=settings.DODO_API_KEY)
    except ImportError:
        # Fallback: use httpx for raw API calls
        import httpx
        return httpx.Client(
            base_url="https://api.dodopayments.com",
            headers={
                "Authorization": f"Bearer {settings.DODO_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )


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

DODO_PRODUCT_IDS = {
    "starter": settings.DODO_STARTER_PRODUCT_ID,
    "growth": settings.DODO_GROWTH_PRODUCT_ID,
    "enterprise": settings.DODO_ENTERPRISE_PRODUCT_ID,
}

PLAN_ENUM_MAP = {
    "starter": Plan.starter,
    "growth": Plan.growth,
    "enterprise": Plan.enterprise,
}


# ── Gateway health checks ──────────────────────────────────────────────────────

def _stripe_configured() -> bool:
    key = settings.STRIPE_SECRET_KEY
    return bool(key) and key not in ("", "sk_test_...")


def _razorpay_configured() -> bool:
    key = settings.RAZORPAY_KEY_ID
    return bool(key) and key not in ("", "rzp_test_...")


def _dodo_configured() -> bool:
    return bool(settings.DODO_API_KEY)


# ── Checkout entry point ───────────────────────────────────────────────────────

async def create_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> dict:
    """
    Returns a dict with gateway-specific info.

    Stripe:   {"gateway": "stripe",   "checkout_url": "https://..."}
    Razorpay: {"gateway": "razorpay", "subscription_id": "sub_...", "key_id": "rzp_..."}
    Dodo:     {"gateway": "dodo",     "payment_link": "https://...", "subscription_id": "..."}
    """
    if plan not in ("starter", "growth", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    gateway_pref = settings.PAYMENT_GATEWAY.lower()

    # ── Dodo mode ─────────────────────────────────────────────────────────────
    if gateway_pref == "dodo":
        if _dodo_configured():
            return await _dodo_checkout(tenant, plan, db)
        raise HTTPException(
            status_code=503,
            detail="Dodo Payments is not configured. Please set DODO_API_KEY."
        )

    # ── Razorpay / Stripe mode (original logic) ───────────────────────────────
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


# ── Stripe ─────────────────────────────────────────────────────────────────────

async def _stripe_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> dict:
    price_id = STRIPE_PRICE_IDS.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Stripe price not configured")

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


# ── Razorpay ───────────────────────────────────────────────────────────────────

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
    return {
        "gateway": "razorpay",
        "subscription_id": subscription["id"],
        "key_id": settings.RAZORPAY_KEY_ID,
    }


# ── Dodo Payments ──────────────────────────────────────────────────────────────

async def _dodo_checkout(tenant: Tenant, plan: str, db: AsyncSession) -> dict:
    """
    Creates a Dodo Payments subscription/payment link.
    Dodo returns a hosted payment link which the frontend redirects to.

    Dodo API reference:
      POST /subscriptions  →  creates subscription, returns payment_link + id
    """
    product_id = DODO_PRODUCT_IDS.get(plan)
    if not product_id:
        raise HTTPException(status_code=400, detail=f"Dodo product ID not configured for '{plan}' plan")

    try:
        client = _get_dodo_client()
        import httpx

        payload = {
            "product_id": product_id,
            "customer": {
                "email": tenant.email,
                "name": tenant.business_name,
            },
            "metadata": {
                "tenant_id": str(tenant.id),
                "plan": plan,
            },
            "return_url": f"{settings.FRONTEND_URL}/dashboard/billing?success=true&gateway=dodo",
            "cancel_url": f"{settings.FRONTEND_URL}/dashboard/billing?cancelled=true",
        }

        # Support both official SDK and raw httpx fallback
        if isinstance(client, httpx.Client):
            resp = client.post("/v1/subscriptions", json=payload)
            resp.raise_for_status()
            data = resp.json()
        else:
            # Official dodopayments SDK
            sub = client.subscriptions.create(**payload)
            data = sub.__dict__ if hasattr(sub, "__dict__") else sub

        return {
            "gateway": "dodo",
            "payment_link": data.get("payment_link") or data.get("checkout_url"),
            "subscription_id": data.get("id") or data.get("subscription_id"),
        }

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Dodo Payments error: {str(e)}")


async def verify_and_activate_dodo(tenant: Tenant, data, db: AsyncSession):
    """
    Called after Dodo redirects the user back with ?payment_id=...&subscription_id=...
    Fetches the subscription from Dodo to confirm it is active, then activates the plan.
    """
    product_id = DODO_PRODUCT_IDS.get(data.plan)
    if not product_id:
        raise HTTPException(status_code=400, detail="Invalid plan")

    try:
        import httpx
        client = _get_dodo_client()

        if isinstance(client, httpx.Client):
            resp = client.get(f"/v1/subscriptions/{data.subscription_id}")
            resp.raise_for_status()
            sub_data = resp.json()
        else:
            sub_obj = client.subscriptions.retrieve(data.subscription_id)
            sub_data = sub_obj.__dict__ if hasattr(sub_obj, "__dict__") else sub_obj

        status = sub_data.get("status", "")
        if status not in ("active", "trialing", "pending"):
            raise HTTPException(status_code=400, detail=f"Dodo subscription not active (status={status})")

        period_end = None
        if sub_data.get("current_period_end"):
            raw = sub_data["current_period_end"]
            if isinstance(raw, (int, float)):
                period_end = datetime.fromtimestamp(raw, tz=timezone.utc)
            else:
                period_end = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Dodo verification error: {str(e)}")

    plan = data.plan
    tenant.plan = PLAN_ENUM_MAP.get(plan, Plan.starter)

    result = await db.execute(select(Subscription).where(Subscription.tenant_id == tenant.id))
    sub = result.scalar_one_or_none()
    if sub:
        sub.gateway = PaymentGateway.dodo
        sub.gateway_subscription_id = data.subscription_id
        sub.status = SubscriptionStatus.active
        sub.plan = plan
        sub.cancel_at_period_end = False
        if period_end:
            sub.current_period_end = period_end
    else:
        sub = Subscription(
            tenant_id=tenant.id,
            gateway=PaymentGateway.dodo,
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


async def handle_dodo_webhook(body: bytes, signature: str | None, db: AsyncSession):
    """
    Handles Dodo Payments webhook events.
    Dodo uses HMAC-SHA256 with a raw body + webhook secret.
    Dodo event types: subscription.activated, subscription.cancelled, payment.succeeded
    """
    secret = settings.DODO_WEBHOOK_SECRET
    if secret and signature:
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid Dodo webhook signature")

    payload = json.loads(body)
    event_type = payload.get("type") or payload.get("event_type") or payload.get("event")
    data = payload.get("data", {}) or payload.get("payload", {})

    # Extract subscription object (handle both flat and nested formats)
    sub_obj = data.get("subscription") or data.get("object") or data
    tenant_id = (sub_obj.get("metadata") or {}).get("tenant_id")
    plan = (sub_obj.get("metadata") or {}).get("plan", "starter")
    sub_id = sub_obj.get("id") or sub_obj.get("subscription_id")

    if not tenant_id or not sub_id:
        return  # Ignore unrecognized payloads

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        return

    if event_type in ("subscription.activated", "payment.succeeded", "subscription.charged"):
        tenant.plan = PLAN_ENUM_MAP.get(plan, Plan.starter)

        # Current period end
        period_end = None
        raw_end = sub_obj.get("current_period_end")
        if raw_end:
            if isinstance(raw_end, (int, float)):
                period_end = datetime.fromtimestamp(raw_end, tz=timezone.utc)
            else:
                try:
                    period_end = datetime.fromisoformat(str(raw_end).replace("Z", "+00:00"))
                except Exception:
                    pass

        result2 = await db.execute(
            select(Subscription).where(Subscription.gateway_subscription_id == sub_id)
        )
        sub = result2.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.active
            sub.plan = plan
            if period_end:
                sub.current_period_end = period_end
        else:
            sub = Subscription(
                tenant_id=tenant.id,
                gateway=PaymentGateway.dodo,
                gateway_subscription_id=sub_id,
                plan=plan,
                status=SubscriptionStatus.active,
                current_period_end=period_end,
            )
            db.add(sub)

        if event_type in ("subscription.activated",):
            email_service.send_plan_upgraded(
                to=tenant.email,
                business_name=tenant.business_name,
                plan=plan,
                messages_limit=PLAN_MESSAGE_LIMITS.get(plan, 1000),
            )

    elif event_type in ("subscription.cancelled", "subscription.deleted"):
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


# ── Stripe webhooks (unchanged) ─────────────────────────────────────────────────

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


# ── Cancel subscription (all gateways) ─────────────────────────────────────────

async def cancel_subscription(tenant: Tenant, db: AsyncSession):
    """Cancel at period end — user keeps access until current period expires."""
    result = await db.execute(select(Subscription).where(Subscription.tenant_id == tenant.id))
    sub = result.scalar_one_or_none()
    if not sub or sub.status != SubscriptionStatus.active:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    if sub.gateway == PaymentGateway.razorpay:
        razorpay_client = _get_razorpay_client()
        try:
            rz_sub = razorpay_client.subscription.fetch(sub.gateway_subscription_id)
            rz_status = rz_sub.get("status", "")
            if rz_status in ("created", "authenticated"):
                razorpay_client.subscription.cancel(sub.gateway_subscription_id, {})
            elif rz_status == "active":
                razorpay_client.subscription.cancel(
                    sub.gateway_subscription_id,
                    {"cancel_at_cycle_end": 1},
                )
        except Exception as e:
            print(f"[billing] Razorpay cancel warning for {sub.gateway_subscription_id}: {e}")

    elif sub.gateway == PaymentGateway.stripe:
        stripe.Subscription.modify(
            sub.gateway_subscription_id,
            cancel_at_period_end=True,
        )

    elif sub.gateway == PaymentGateway.dodo:
        try:
            import httpx
            client = _get_dodo_client()
            if isinstance(client, httpx.Client):
                resp = client.post(f"/v1/subscriptions/{sub.gateway_subscription_id}/cancel")
                resp.raise_for_status()
            else:
                client.subscriptions.cancel(sub.gateway_subscription_id)
        except Exception as e:
            print(f"[billing] Dodo cancel warning for {sub.gateway_subscription_id}: {e}")

    sub.cancel_at_period_end = True
    await db.commit()


# ── Razorpay verify (unchanged) ─────────────────────────────────────────────────

async def verify_and_activate_razorpay(tenant: Tenant, data, db: AsyncSession):
    """
    Called immediately after checkout.js handler fires.
    Verifies the Razorpay payment signature and activates the plan.
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

    razorpay_client = _get_razorpay_client()
    rz_sub = razorpay_client.subscription.fetch(data.subscription_id)
    period_end = None
    if rz_sub.get("current_end"):
        period_end = datetime.fromtimestamp(rz_sub["current_end"], tz=timezone.utc)

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
