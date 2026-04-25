import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

FRONTEND_URL = settings.FRONTEND_URL

def _send_whatsapp_template(
    *,
    phone_number_id: str,
    access_token: str,
    to: str,
    template_name: str,
    language_code: str = "en_US",
    components: list | None = None
) -> bool:
    """
    Internal helper to send a WhatsApp template message via Meta Cloud API.
    Returns True if successful, logs and returns False on error.
    """
    version = getattr(settings, "WHATSAPP_API_VERSION", "v21.0")
    url = f"https://graph.facebook.com/{version}/{phone_number_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        }
    }
    
    if components:
        payload["template"]["components"] = components

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code >= 300:
                logger.warning(f"[WhatsApp] Meta API returned {resp.status_code}: {resp.text}")
                return False
            return True
    except Exception as e:
        logger.error(f"[WhatsApp] Failed to send message to {to}: {e}")
        return False


def notify_whatsapp_escalation(
    *,
    phone_number_id: str | None,
    access_token: str | None,
    recipients: list[str] | None,
    business_name: str,
    conversation_id: str,
    visitor_name: str | None,
    visitor_message: str,
) -> None:
    """Post an AI-failure alert to tenant's WhatsApp numbers."""
    if not phone_number_id or not access_token or not recipients:
        return

    visitor_label = visitor_name or "A visitor"
    dashboard_link = f"{FRONTEND_URL}/dashboard/conversations/{conversation_id}"
    truncated_msg = (visitor_message or "")[:100] # Keep it short for WhatsApp

    # Template expected params (example):
    # 1: business_name
    # 2: visitor_label
    # 3: truncated_msg
    # 4: dashboard_link
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": business_name},
                {"type": "text", "text": visitor_label},
                {"type": "text", "text": truncated_msg},
                {"type": "text", "text": dashboard_link},
            ]
        }
    ]

    for phone in recipients:
        _send_whatsapp_template(
            phone_number_id=phone_number_id,
            access_token=access_token,
            to=phone,
            template_name="escalation_alert",
            components=components
        )


def notify_whatsapp_keyword_alert(
    *,
    phone_number_id: str | None,
    access_token: str | None,
    recipients: list[str] | None,
    business_name: str,
    conversation_id: str,
    visitor_name: str | None,
    visitor_message: str,
    matched_keywords: str,
) -> None:
    """Post a keyword alert to tenant's WhatsApp numbers."""
    if not phone_number_id or not access_token or not recipients:
        return

    visitor_label = visitor_name or "A visitor"
    dashboard_link = f"{FRONTEND_URL}/dashboard/conversations/{conversation_id}"
    truncated_msg = (visitor_message or "")[:100]

    # Template expected params (example):
    # 1: business_name
    # 2: matched_keywords
    # 3: visitor_label
    # 4: truncated_msg
    # 5: dashboard_link
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": business_name},
                {"type": "text", "text": matched_keywords},
                {"type": "text", "text": visitor_label},
                {"type": "text", "text": truncated_msg},
                {"type": "text", "text": dashboard_link},
            ]
        }
    ]

    for phone in recipients:
        _send_whatsapp_template(
            phone_number_id=phone_number_id,
            access_token=access_token,
            to=phone,
            template_name="keyword_alert",
            components=components
        )


def send_whatsapp_test(
    *,
    phone_number_id: str,
    access_token: str,
    to: str,
    business_name: str
) -> bool:
    """Send a basic test message so tenants can verify their configuration."""
    components = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": business_name},
            ]
        }
    ]
    return _send_whatsapp_template(
        phone_number_id=phone_number_id,
        access_token=access_token,
        to=to,
        template_name="notification_test",
        components=components
    )


# NOTE: Meta Cloud API requires pre-approved templates. 
# Expected templates for this service:
# 1. escalation_alert: Params {{1}}=business_name, {{2}}=visitor_label, {{3}}=truncated_msg, {{4}}=dashboard_link
# 2. keyword_alert: Params {{1}}=business_name, {{2}}=matched_keywords, {{3}}=visitor_label, {{4}}=truncated_msg, {{5}}=dashboard_link
# 3. notification_test: Params {{1}}=business_name
