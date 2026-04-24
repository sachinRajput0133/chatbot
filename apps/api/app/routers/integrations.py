"""
Per-tenant integration settings. Currently: Slack incoming webhook for AI-escalation alerts.
All endpoints require an authenticated user; the webhook is scoped to that user's tenant.
"""
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import encrypt_secret, decrypt_secret, InvalidToken
from app.core.security import get_current_user_id
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.integrations import (
    SlackIntegrationStatus,
    SetSlackWebhookRequest,
    TestSlackRequest,
    TestSlackResponse,
    NotificationEmailsConfig,
    SetNotificationEmailsRequest,
    TestEmailResponse,
)
from app.services import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations", tags=["integrations"])
limiter = Limiter(key_func=get_remote_address)


async def _get_tenant_for_user(user_id: str, db: AsyncSession) -> Tenant:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    tenant = (await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _mask(url: str) -> str:
    """Return a human-safe preview like 'hooks.slack.com/services/T01ABC/…/abc1234'."""
    try:
        without_scheme = url.split("://", 1)[1]
    except IndexError:
        without_scheme = url
    parts = without_scheme.split("/")
    # parts ~ ["hooks.slack.com", "services", "Txxx", "Byyy", "zzz..."]
    if len(parts) >= 5:
        last = parts[-1]
        tail = last[-7:] if len(last) > 7 else last
        return f"{parts[0]}/{parts[1]}/{parts[2]}/…/{tail}"
    return "hooks.slack.com/…"


@router.get("/slack", response_model=SlackIntegrationStatus)
async def get_slack_status(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    if not tenant.slack_webhook_url:
        return SlackIntegrationStatus(configured=False, masked_url=None)
    try:
        plain = decrypt_secret(tenant.slack_webhook_url)
    except InvalidToken:
        # Ciphertext is unreadable (e.g. ENCRYPTION_KEY changed). Surface as "not configured"
        # rather than leaking the broken state — admin can re-save to fix.
        logger.warning(f"[Integrations] Unreadable slack_webhook_url for tenant {tenant.id}")
        return SlackIntegrationStatus(configured=False, masked_url=None)
    return SlackIntegrationStatus(configured=True, masked_url=_mask(plain))


@router.put("/slack", response_model=SlackIntegrationStatus)
async def set_slack_webhook(
    data: SetSlackWebhookRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    tenant.slack_webhook_url = encrypt_secret(data.webhook_url)
    await db.commit()
    await db.refresh(tenant)
    return SlackIntegrationStatus(configured=True, masked_url=_mask(data.webhook_url))


@router.delete("/slack", status_code=204)
async def delete_slack_webhook(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    tenant.slack_webhook_url = None
    await db.commit()


@router.post("/slack/test", response_model=TestSlackResponse)
@limiter.limit("5/minute")
async def test_slack_webhook(
    request: Request,
    data: TestSlackRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Post a sample message. If `webhook_url` is provided, test that URL directly
    (so users can verify before saving). Otherwise, test the stored URL.
    """
    tenant = await _get_tenant_for_user(user_id, db)

    url: str | None = data.webhook_url
    if url is None:
        if not tenant.slack_webhook_url:
            raise HTTPException(status_code=400, detail="No Slack webhook configured yet")
        try:
            url = decrypt_secret(tenant.slack_webhook_url)
        except InvalidToken:
            raise HTTPException(status_code=500, detail="Stored webhook is unreadable — please re-save it")
    else:
        if not url.startswith("https://hooks.slack.com/services/"):
            raise HTTPException(status_code=400, detail="webhook_url must be a Slack incoming-webhook URL")

    payload = {
        "text": (
            f":white_check_mark: *ChatBot AI* — Slack integration test for "
            f"*{tenant.business_name}*. If you see this message, escalation alerts will "
            f"be delivered here."
        ),
    }
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code >= 300:
            return TestSlackResponse(
                ok=False,
                detail=f"Slack returned HTTP {resp.status_code}: {resp.text[:200]}",
            )
        return TestSlackResponse(ok=True)
    except httpx.HTTPError as e:
        return TestSlackResponse(ok=False, detail=f"Network error: {e}")


@router.get("/email-notifications", response_model=NotificationEmailsConfig)
async def get_notification_emails(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    return NotificationEmailsConfig(
        primary_email=tenant.primary_notification_email,
        cc_emails=tenant.notification_emails or [],
        account_email=tenant.email,
    )


@router.put("/email-notifications", response_model=NotificationEmailsConfig)
async def set_notification_emails(
    data: SetNotificationEmailsRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    tenant.primary_notification_email = data.primary_email
    tenant.notification_emails = data.cc_emails or None
    await db.commit()
    await db.refresh(tenant)
    return NotificationEmailsConfig(
        primary_email=tenant.primary_notification_email,
        cc_emails=tenant.notification_emails or [],
        account_email=tenant.email,
    )


@router.post("/email-notifications/test", response_model=TestEmailResponse)
@limiter.limit("5/minute")
async def test_notification_email(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a sample escalation-style email to the currently configured primary + CCs."""
    tenant = await _get_tenant_for_user(user_id, db)

    primary = tenant.primary_notification_email or tenant.email
    cc_list = [
        addr for addr in (tenant.notification_emails or [])
        if addr.lower() != primary.lower()
    ]

    try:
        import asyncio
        await asyncio.to_thread(
            email_service.send_notification_test,
            to=primary,
            business_name=tenant.business_name,
            cc=cc_list or None,
        )
    except Exception as e:
        logger.warning(f"[Integrations] Test email failed for tenant {tenant.id}: {e}")
        return TestEmailResponse(
            ok=False,
            sent_to=primary,
            cc_count=len(cc_list),
            detail=f"Failed to send: {e}",
        )

    # send_notification_test swallows Resend errors (fire-and-forget). If RESEND_API_KEY is
    # unset it silently no-ops — surface that so the UI doesn't pretend everything worked.
    from app.core.config import settings
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY.startswith("re_..."):
        return TestEmailResponse(
            ok=False,
            sent_to=primary,
            cc_count=len(cc_list),
            detail="Email is not configured on the server yet (RESEND_API_KEY missing). Contact the platform admin.",
        )

    return TestEmailResponse(ok=True, sent_to=primary, cc_count=len(cc_list))
