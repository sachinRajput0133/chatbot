"""
Email service using Resend.
All sends are fire-and-forget — errors are logged but never surface to the user.
"""
import logging
import resend
from app.core.config import settings

logger = logging.getLogger(__name__)

FRONTEND_URL = settings.FRONTEND_URL


def _send(*, to: str, subject: str, html: str) -> None:
    """Send an email. Silently logs on failure so it never breaks the caller."""
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY.startswith("re_..."):
        logger.info(f"[Email] RESEND_API_KEY not set — skipping email to {to}: {subject}")
        return
    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info(f"[Email] Sent '{subject}' to {to}")
    except Exception as e:
        logger.warning(f"[Email] Failed to send '{subject}' to {to}: {e}")


# ── Templates ─────────────────────────────────────────────────────────────────

def _base(content: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f9fafb; margin: 0; padding: 0; }}
    .wrap {{ max-width: 600px; margin: 40px auto; background: #fff;
             border-radius: 12px; overflow: hidden;
             box-shadow: 0 1px 8px rgba(0,0,0,0.08); }}
    .header {{ background: #6366f1; padding: 32px 40px; text-align: center; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 24px; font-weight: 700; }}
    .header p {{ color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }}
    .body {{ padding: 36px 40px; color: #374151; font-size: 15px; line-height: 1.7; }}
    .body h2 {{ color: #111827; font-size: 20px; margin: 0 0 12px; }}
    .btn {{ display: inline-block; margin: 24px 0; padding: 14px 32px;
            background: #6366f1; color: #fff !important; text-decoration: none;
            border-radius: 8px; font-weight: 600; font-size: 15px; }}
    .step {{ display: flex; gap: 14px; margin: 16px 0; align-items: flex-start; }}
    .step-num {{ background: #ede9fe; color: #6366f1; border-radius: 50%;
                 width: 28px; height: 28px; display: flex; align-items: center;
                 justify-content: center; font-weight: 700; font-size: 13px;
                 flex-shrink: 0; margin-top: 2px; }}
    .step-text {{ flex: 1; }}
    .step-text strong {{ color: #111827; }}
    .divider {{ border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }}
    .footer {{ padding: 20px 40px 32px; color: #9ca3af; font-size: 13px;
               text-align: center; }}
    .footer a {{ color: #6366f1; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>ChatBot AI</h1>
      <p>The AI chatbot for your website</p>
    </div>
    <div class="body">{content}</div>
    <div class="footer">
      <p>ChatBot AI · <a href="{FRONTEND_URL}">{FRONTEND_URL}</a></p>
      <p>You received this because you signed up for ChatBot AI.</p>
    </div>
  </div>
</body>
</html>
"""


def send_welcome(*, to: str, business_name: str, bot_id: str) -> None:
    """Welcome email sent immediately after signup."""
    content = f"""
<h2>Welcome to ChatBot AI, {business_name}! 🎉</h2>
<p>Your AI chatbot is ready. Here's how to get it live on your website in the next 10 minutes:</p>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-text">
    <strong>Upload your knowledge</strong><br>
    Add FAQs, product info, pricing — anything your customers ask about.
  </div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-text">
    <strong>Customize your bot</strong><br>
    Set the name, color, and welcome message to match your brand.
  </div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-text">
    <strong>Paste one script tag</strong><br>
    Copy the embed code and paste it on your website — works on WordPress, Wix, Shopify, and any HTML page.
  </div>
</div>

<a href="{FRONTEND_URL}/dashboard" class="btn">Go to your dashboard →</a>

<hr class="divider">
<p style="color:#6b7280;font-size:14px;">
  Your bot ID: <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-size:13px;">{bot_id}</code><br>
  Keep this handy — you'll need it for the embed script.
</p>
<p style="color:#6b7280;font-size:14px;">
  Need help? Just reply to this email or use the <strong>?</strong> help button in your dashboard.
</p>
"""
    _send(to=to, subject=f"Welcome to ChatBot AI — your bot is ready 🚀", html=_base(content))


def send_plan_upgraded(*, to: str, business_name: str, plan: str, messages_limit: int) -> None:
    """Sent when a user upgrades to a paid plan."""
    plan_label = plan.capitalize()
    limit_label = f"{messages_limit:,}" if messages_limit < 999999 else "Unlimited"
    content = f"""
<h2>You're on the {plan_label} plan! 🎊</h2>
<p>Hi {business_name}, your upgrade was successful. Here's what you now have:</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr style="background:#f9fafb;">
    <td style="padding:12px 16px;border-radius:8px 0 0 8px;color:#6b7280;font-size:14px;">Plan</td>
    <td style="padding:12px 16px;border-radius:0 8px 8px 0;font-weight:600;color:#111827;">{plan_label}</td>
  </tr>
  <tr>
    <td style="padding:12px 16px;color:#6b7280;font-size:14px;">Messages / month</td>
    <td style="padding:12px 16px;font-weight:600;color:#111827;">{limit_label}</td>
  </tr>
</table>

<a href="{FRONTEND_URL}/dashboard" class="btn">Go to dashboard →</a>

<p style="color:#6b7280;font-size:14px;margin-top:24px;">
  Questions about your plan? Reply to this email anytime.
</p>
"""
    _send(to=to, subject=f"Your ChatBot AI plan upgraded to {plan_label} ✅", html=_base(content))


def send_plan_cancelled(*, to: str, business_name: str) -> None:
    """Sent when a subscription is cancelled."""
    content = f"""
<h2>Your subscription has been cancelled</h2>
<p>Hi {business_name}, we've processed your cancellation. Your account will stay active until the end of your current billing period, after which it will revert to the Free plan (100 messages/month).</p>

<p>Your uploaded knowledge and chat history are safe — nothing is deleted.</p>

<a href="{FRONTEND_URL}/dashboard/billing" class="btn">Reactivate anytime →</a>

<p style="color:#6b7280;font-size:14px;margin-top:24px;">
  We'd love to know why you cancelled — just reply to this email.
</p>
"""
    _send(to=to, subject="ChatBot AI subscription cancelled", html=_base(content))
