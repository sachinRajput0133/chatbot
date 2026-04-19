# AI Failure → Human Escalation

When the AI provider (Groq / Anthropic / OpenAI / Gemini / Grok) fails on a live
visitor chat, the conversation auto-switches to **human mode** and the tenant is
notified by email and (optionally) Slack so an agent can take over.

The visitor never sees a 500 error — they get a graceful fallback message.

---

## ⚠️ Action required before this works in production

Two things need to be configured outside the codebase. **They are NOT set up yet
as of writing this doc.** Whoever picks this up next needs to:

### 1. Resend API key (for email alerts)

- Create an account at https://resend.com
- Verify your sending domain (add the DNS records Resend gives you)
- Generate an API key
- Paste it into `.env`:
  ```env
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
  FROM_EMAIL=alerts@yourdomain.com
  ```
- Without this, escalation emails are silently skipped (logged as
  `[Email] RESEND_API_KEY not set — skipping email to ...`). The rest of the
  escalation flow still works.

### 2. Slack incoming webhook (optional, for Slack alerts)

- In Slack, go to your workspace → Apps → search "Incoming Webhooks" → Add
- Pick the channel where alerts should land (e.g. `#support-alerts`)
- Copy the webhook URL
- Paste it into `.env`:
  ```env
  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx
  ```
- If empty, Slack step is silently skipped — email still fires.

Restart the API after editing `.env`:

```bash
# kill the uvicorn process, then:
cd apps/api
.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

(`--reload` only watches `.py` files, not `.env` — env changes need a real
restart.)

---

## How it works

### Flow

```
visitor sends message
        │
        ▼
handle_chat() in chat_service.py
        │
        ├─ conv.mode == "human"? ──► skip AI, broadcast user msg only
        │
        ├─ call _call_ai(messages, system_prompt)
        │       │
        │       ├─ SUCCESS ──► store assistant reply, broadcast, return
        │       │
        │       └─ EXCEPTION ──► _escalate_to_human():
        │                         1. conv.mode = "human"
        │                         2. store fallback reply as assistant msg
        │                         3. publish {"type": "ai_escalation"} to
        │                            tenant + conversation Redis channels
        │                         4. fire-and-forget email + Slack alert
        │                         5. return fallback text to visitor
```

### Fallback message to the visitor

```
Our AI assistant is temporarily unavailable. A human team member will
follow up with you shortly — thank you for your patience!
```

Defined as `AI_FAILURE_FALLBACK` at the top of `apps/api/app/services/chat_service.py`.

### What the tenant receives

**Email** (via Resend) — red-banner HTML template with:
- Business name
- Visitor name / email (if captured via lead form)
- Visitor's actual message (truncated to 500 chars, HTML-escaped)
- The error detail (e.g. `AuthenticationError: Invalid API Key`)
- Deep link: `{FRONTEND_URL}/dashboard/conversations/{conversation_id}`

**Slack** (via incoming webhook) — blocks payload with the same info plus an
"Open conversation" primary button.

Both are fire-and-forget (`asyncio.create_task(_notify())`) so the visitor's
HTTP response isn't delayed by email or Slack latency.

---

## Files changed by this feature

| File | Change |
|------|--------|
| `apps/api/app/core/config.py` | Added `SLACK_WEBHOOK_URL: str = ""` setting |
| `apps/api/app/services/email_service.py` | Added `send_ai_escalation()` template + `notify_slack_escalation()` |
| `apps/api/app/services/chat_service.py` | Wrapped `_call_ai()` call in try/except, added `_escalate_to_human()` helper, defined `AI_FAILURE_FALLBACK` constant |
| `.env` / `.env.example` | Documented `SLACK_WEBHOOK_URL` variable |

No new DB columns or migrations — reused the existing `WebConversation.mode`
column (which already supported `'ai'` / `'human'`).

---

## Testing

### Happy path (AI works)

```bash
curl -X POST http://localhost:8000/api/chat/{BOT_ID} \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "visitor_id": "test-1"}'
```

Should return a real AI reply.

### Escalation path (simulate AI failure)

1. Edit `.env`, break the Groq key (e.g. append a stray character):
   ```
   GROQ_API_KEY=gsk_...INVALID
   ```
2. Restart the API (see above — `--reload` doesn't reload env changes).
3. Send another chat message (same curl).
4. Expected response:
   ```json
   {
     "reply": "Our AI assistant is temporarily unavailable. A human team member will follow up with you shortly — thank you for your patience!",
     "message_id": "...",
     "conversation_id": "..."
   }
   ```
5. Verify side effects in the DB:
   ```sql
   SELECT id, mode FROM web_conversations WHERE id = '<conversation_id>';
   -- mode should be 'human'

   SELECT role, content FROM web_messages WHERE conversation_id = '<conversation_id>';
   -- should show the user msg AND the fallback assistant msg
   ```
6. Check API logs for:
   ```
   [AI Escalation] Provider failed for conversation <id>: <error>
   [Email] Sent '⚠️ Action needed — AI couldn't reply to a visitor' to <tenant_email>
   [Slack] Sent escalation for conversation <id>
   ```
   (Email/Slack lines only appear if those keys are configured — see top of doc.)
7. Restore the valid key and restart.

---

## Known limitations / follow-ups

These weren't done in v1 — document them so they don't get forgotten.

### Must-fix before heavy production use

- **No retry on transient failures.** Any exception from the AI provider (even
  a 1-second network blip) immediately triggers escalation. Add 1-2 retries
  with short backoff inside `_call_ai()` before raising.
- **No rate limit on escalation emails.** If Groq has a 10-minute outage and
  50 visitors chat, 50 emails will be sent to the tenant. Add a per-tenant
  Redis key (`escalation_notified:{tenant_id}`) with a cooldown (e.g. 1 email
  per tenant per 15 min).
- **Pre-existing bug, unrelated but related enough to flag:**
  `apps/api/app/services/chat_service.py:346` returns
  `"__human_mode__", conv.id` (2-tuple) when the caller in `chat.py:139`
  unpacks 3 values — would crash any time a visitor sends a message to a
  conversation already in human mode.

### Should-have

- **Multi-provider runtime failover.** Currently `_active_provider()` picks
  ONE provider at startup and uses only that. If Groq fails, we escalate to
  human immediately instead of trying Anthropic/OpenAI. A real fallback chain
  would reduce human escalations dramatically.
- **Dashboard toast for `ai_escalation` events.** The feature already publishes
  `{"type": "ai_escalation", ...}` to the tenant's Redis pub/sub channel —
  but no frontend code listens for it. Add a red banner / browser
  notification in the dashboard when this event fires.
- **Auto-resume to AI mode.** A conversation that escalates is stuck in
  `human` mode forever. Add a "Return to AI" button in the agent dashboard
  (or auto-resume after agent marks the conversation resolved).

### Nice-to-have

- **Per-tenant Slack webhook.** Right now `SLACK_WEBHOOK_URL` is server-wide,
  so all tenants' escalations post to the same channel (the platform
  operator's). Add a `slack_webhook_url` column to `widget_configs` (or a
  new `notification_settings` table) and let tenants configure it from
  `/dashboard/notifications`. Include a "Test" button that fires a sample
  message. See discussion in the team chat — per-tenant **email key** is
  NOT recommended (too much friction for SMB customers; use the server-wide
  Resend key with `reply_to: tenant.email`).
- **Logger level.** Python default is WARNING — `logger.info("[Email]...")`
  lines don't appear in logs. Bump to INFO in dev for easier debugging.
- **Unit test.** Mock `_call_ai` to raise, assert `conv.mode == "human"` and
  the fallback message is returned and stored.

---

## Key functions / entry points

- `apps/api/app/services/chat_service.py::_escalate_to_human` — the main
  escalation handler. Starts here if you're debugging why an alert didn't
  fire.
- `apps/api/app/services/email_service.py::send_ai_escalation` — the
  Resend email template.
- `apps/api/app/services/email_service.py::notify_slack_escalation` — the
  Slack webhook payload.
- `apps/api/app/services/chat_service.py::AI_FAILURE_FALLBACK` — the message
  the visitor sees. Edit here if copy needs to change.
