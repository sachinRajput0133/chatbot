# Per-Tenant Notification-Email CCs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let each tenant configure up to 5 extra email addresses that get CC'd on AI-escalation alerts (in addition to the account-owner email, which always gets them).

**Architecture:**
- New `tenants.notification_emails jsonb` column (nullable, stores a JSON array of strings). No encryption needed — emails are not secrets.
- Extend `_send()` to take optional `cc: list[str]`; extend `send_ai_escalation()` the same way; pass `tenant.notification_emails or None` from `chat_service._escalate_to_human()`.
- New endpoints `GET/PUT /api/integrations/email-notifications` on the existing integrations router. No separate page — add a second card on the existing `/dashboard/integrations` page under the Slack card.

**Tech Stack:** Same as the Slack plan. Resend's API accepts `cc: [...]` natively, so no fan-out needed.

**No-auto-commit rule:** Stage files but do NOT commit. The user reviews and commits manually.

**Testing note:** No pytest infrastructure; verify manually with curl + browser.

---

## File Structure

**Create:**
- `apps/api/alembic/versions/j5k6l7m8n9o0_add_notification_emails_to_tenants.py`

**Modify:**
- `apps/api/app/models/tenant.py` — add `notification_emails: list[str] | None` (JSONB)
- `apps/api/app/schemas/integrations.py` — add `NotificationEmailsConfig`, `SetNotificationEmailsRequest`
- `apps/api/app/routers/integrations.py` — add `GET`/`PUT /email-notifications`
- `apps/api/app/services/email_service.py` — `_send()` and `send_ai_escalation()` take optional `cc`
- `apps/api/app/services/chat_service.py` — pass `tenant.notification_emails` as `cc`
- `apps/web/lib/api/integrationsApi.ts` — add 2 endpoints + type
- `apps/web/app/dashboard/integrations/page.tsx` — add a second card below the Slack one

---

## Task 1: DB Column + Migration + Model

**Files:**
- Modify: `apps/api/app/models/tenant.py`
- Create: `apps/api/alembic/versions/j5k6l7m8n9o0_add_notification_emails_to_tenants.py`

- [ ] **Step 1: Confirm current alembic head**

```bash
cd /home/knovator/personal/chatbot/apps/api && .venv/bin/alembic heads
```

Expected: `i4j5k6l7m8n9 (head)` (from the Slack migration). If it's something else, use that value as the `down_revision` in Step 3.

- [ ] **Step 2: Add column to the Tenant model**

Edit `apps/api/app/models/tenant.py`. Add `JSONB` to the postgres dialect import line (currently `from sqlalchemy.dialects.postgresql import UUID`):

```python
from sqlalchemy.dialects.postgresql import UUID, JSONB
```

Then, immediately after the `slack_webhook_url` column (the one added by the previous feature), add:

```python
    # Up to 5 additional email addresses that get CC'd on escalation alerts,
    # on top of the account-owner email stored in `email`.
    notification_emails: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
```

- [ ] **Step 3: Create the migration**

Create `apps/api/alembic/versions/j5k6l7m8n9o0_add_notification_emails_to_tenants.py`:

```python
"""add notification_emails to tenants

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-04-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'j5k6l7m8n9o0'
down_revision = 'i4j5k6l7m8n9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('notification_emails', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'notification_emails')
```

If Step 1 returned a different head, replace `'i4j5k6l7m8n9'` in `down_revision` with that value.

- [ ] **Step 4: Apply and verify**

```bash
cd /home/knovator/personal/chatbot/apps/api && .venv/bin/alembic upgrade head
.venv/bin/python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' AND column_name='notification_emails'\"))
        print(r.fetchall())

asyncio.run(main())
"
```

Expected: `[('notification_emails', 'jsonb')]`.

- [ ] **Step 5: Stage (do NOT commit)**

```bash
cd /home/knovator/personal/chatbot && git add apps/api/app/models/tenant.py apps/api/alembic/versions/j5k6l7m8n9o0_add_notification_emails_to_tenants.py
```

---

## Task 2: Service Layer — `_send()` and `send_ai_escalation()` Take `cc`

**Files:**
- Modify: `apps/api/app/services/email_service.py`
- Modify: `apps/api/app/services/chat_service.py`

- [ ] **Step 1: Extend `_send()` to accept optional `cc`**

In `apps/api/app/services/email_service.py`, replace the current `_send` function (around lines 15-30) with:

```python
def _send(*, to: str, subject: str, html: str, cc: list[str] | None = None) -> None:
    """Send an email. Silently logs on failure so it never breaks the caller."""
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY.startswith("re_..."):
        logger.info(f"[Email] RESEND_API_KEY not set — skipping email to {to}: {subject}")
        return
    try:
        resend.api_key = settings.RESEND_API_KEY
        payload: dict = {
            "from": settings.FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if cc:
            payload["cc"] = cc
        resend.Emails.send(payload)
        logger.info(f"[Email] Sent '{subject}' to {to}" + (f" (cc={len(cc)})" if cc else ""))
    except Exception as e:
        logger.warning(f"[Email] Failed to send '{subject}' to {to}: {e}")
```

- [ ] **Step 2: Extend `send_ai_escalation()` to accept and pass `cc`**

Still in `apps/api/app/services/email_service.py`, find `send_ai_escalation` (around line 156). Add a `cc: list[str] | None = None` keyword-only parameter to the signature (after `error_detail: str`) and change the final `_send(...)` call inside that function to forward it.

Replace the existing signature block:

```python
def send_ai_escalation(
    *,
    to: str,
    business_name: str,
    conversation_id: str,
    visitor_name: str | None,
    visitor_email: str | None,
    visitor_message: str,
    error_detail: str,
) -> None:
```

with:

```python
def send_ai_escalation(
    *,
    to: str,
    business_name: str,
    conversation_id: str,
    visitor_name: str | None,
    visitor_email: str | None,
    visitor_message: str,
    error_detail: str,
    cc: list[str] | None = None,
) -> None:
```

And change the `_send(...)` call at the bottom of that function from:

```python
    _send(
        to=to,
        subject=f"⚠️ Action needed — AI couldn't reply to a visitor",
        html=_base(content),
    )
```

to:

```python
    _send(
        to=to,
        subject=f"⚠️ Action needed — AI couldn't reply to a visitor",
        html=_base(content),
        cc=cc,
    )
```

- [ ] **Step 3: Pass `tenant.notification_emails` from `chat_service._escalate_to_human`**

In `apps/api/app/services/chat_service.py`, find the `asyncio.to_thread(email_service.send_ai_escalation, ...)` call inside `_notify` (in `_escalate_to_human`). Add `cc=tenant.notification_emails or None` as a kwarg:

Existing call shape:

```python
            await asyncio.to_thread(
                email_service.send_ai_escalation,
                to=tenant.email,
                business_name=tenant.business_name,
                conversation_id=str(conv.id),
                visitor_name=conv.visitor_name,
                visitor_email=conv.visitor_email,
                visitor_message=visitor_message,
                error_detail=error_detail,
            )
```

Change to (add the last line, preserve everything else):

```python
            await asyncio.to_thread(
                email_service.send_ai_escalation,
                to=tenant.email,
                business_name=tenant.business_name,
                conversation_id=str(conv.id),
                visitor_name=conv.visitor_name,
                visitor_email=conv.visitor_email,
                visitor_message=visitor_message,
                error_detail=error_detail,
                cc=tenant.notification_emails or None,
            )
```

- [ ] **Step 4: Import sanity check**

```bash
cd /home/knovator/personal/chatbot/apps/api && .venv/bin/python -c "from app.services import email_service, chat_service; print('ok')"
```

Expected: `ok`.

- [ ] **Step 5: Stage (do NOT commit)**

```bash
cd /home/knovator/personal/chatbot && git add apps/api/app/services/email_service.py apps/api/app/services/chat_service.py
```

---

## Task 3: Schemas + Router Endpoints

**Files:**
- Modify: `apps/api/app/schemas/integrations.py`
- Modify: `apps/api/app/routers/integrations.py`

- [ ] **Step 1: Add schemas**

Append to `apps/api/app/schemas/integrations.py`:

```python
from pydantic import EmailStr


MAX_NOTIFICATION_EMAILS = 5


class NotificationEmailsConfig(BaseModel):
    emails: list[EmailStr] = Field(default_factory=list, max_length=MAX_NOTIFICATION_EMAILS)


class SetNotificationEmailsRequest(BaseModel):
    emails: list[EmailStr] = Field(default_factory=list, max_length=MAX_NOTIFICATION_EMAILS)

    @field_validator("emails")
    @classmethod
    def _dedupe_lowercase(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for e in v:
            key = e.lower()
            if key not in seen:
                seen.add(key)
                out.append(key)
        return out
```

Note: `EmailStr` already exists in pydantic; import it at the top along with the existing `BaseModel, Field, field_validator` line, e.g.:

```python
from pydantic import BaseModel, Field, field_validator, EmailStr
```

Pydantic's `EmailStr` requires the `email-validator` dependency — it's already installed via `pydantic[email]==2.8.2` in `requirements.txt`, so no pip install needed.

- [ ] **Step 2: Add router endpoints**

In `apps/api/app/routers/integrations.py`, add to the imports block:

```python
from app.schemas.integrations import (
    SlackIntegrationStatus,
    SetSlackWebhookRequest,
    TestSlackRequest,
    TestSlackResponse,
    NotificationEmailsConfig,
    SetNotificationEmailsRequest,
)
```

At the bottom of the file, append:

```python
@router.get("/email-notifications", response_model=NotificationEmailsConfig)
async def get_notification_emails(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    return NotificationEmailsConfig(emails=tenant.notification_emails or [])


@router.put("/email-notifications", response_model=NotificationEmailsConfig)
async def set_notification_emails(
    data: SetNotificationEmailsRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    tenant.notification_emails = data.emails or None
    await db.commit()
    await db.refresh(tenant)
    return NotificationEmailsConfig(emails=tenant.notification_emails or [])
```

- [ ] **Step 3: Verify routes**

```bash
curl -s http://localhost:8000/openapi.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(sorted([(m.upper(),p) for p,ops in d['paths'].items() for m in ops if '/integrations/email-notifications' in p]))"
```

Expected: `[('GET', '/api/integrations/email-notifications'), ('PUT', '/api/integrations/email-notifications')]`.

If the API is not running, start it with `cd apps/api && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/api.log 2>&1 &` and kill it after with `pkill -f "uvicorn app.main:app"`.

- [ ] **Step 4: Stage (do NOT commit)**

```bash
cd /home/knovator/personal/chatbot && git add apps/api/app/schemas/integrations.py apps/api/app/routers/integrations.py
```

---

## Task 4: Frontend — Email Notifications Card

**Files:**
- Modify: `apps/web/lib/api/integrationsApi.ts`
- Modify: `apps/web/app/dashboard/integrations/page.tsx`

- [ ] **Step 1: Add API endpoints to the slice**

In `apps/web/lib/api/integrationsApi.ts`, add a new type + two endpoints. Replace the file with:

```typescript
import { baseApi } from "./baseApi";

export interface SlackIntegrationStatus {
  configured: boolean;
  masked_url: string | null;
}

export interface TestSlackResponse {
  ok: boolean;
  detail: string | null;
}

export interface NotificationEmailsConfig {
  emails: string[];
}

export const integrationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    slackStatus: build.query<SlackIntegrationStatus, void>({
      query: () => "/api/integrations/slack",
      providesTags: ["Integrations"],
    }),
    setSlackWebhook: build.mutation<SlackIntegrationStatus, { webhook_url: string }>({
      query: (body) => ({ url: "/api/integrations/slack", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
    deleteSlackWebhook: build.mutation<void, void>({
      query: () => ({ url: "/api/integrations/slack", method: "DELETE" }),
      invalidatesTags: ["Integrations"],
    }),
    testSlackWebhook: build.mutation<TestSlackResponse, { webhook_url?: string }>({
      query: (body) => ({ url: "/api/integrations/slack/test", method: "POST", body }),
    }),
    notificationEmails: build.query<NotificationEmailsConfig, void>({
      query: () => "/api/integrations/email-notifications",
      providesTags: ["Integrations"],
    }),
    setNotificationEmails: build.mutation<NotificationEmailsConfig, { emails: string[] }>({
      query: (body) => ({ url: "/api/integrations/email-notifications", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
  }),
});

export const {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
  useNotificationEmailsQuery,
  useSetNotificationEmailsMutation,
} = integrationsApi;
```

- [ ] **Step 2: Add the card to the Integrations page**

In `apps/web/app/dashboard/integrations/page.tsx`, at the top of the imports, add the new hooks:

```typescript
import {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
  useNotificationEmailsQuery,
  useSetNotificationEmailsMutation,
} from "@/lib/api";
```

At the bottom of the existing `<section>` (just before the closing `</div>` that wraps the max-w-3xl container), insert:

```tsx
      <EmailNotificationsCard />
```

Then, at the very end of the file (after the default-exported `IntegrationsPage` component), append this component definition:

```tsx
const MAX_EMAILS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailNotificationsCard() {
  const { data } = useNotificationEmailsQuery();
  const [setEmails, { isLoading: saving }] = useSetNotificationEmailsMutation();

  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState<Banner>(null);
  const current = data?.emails ?? [];

  async function commit(next: string[]) {
    setBanner(null);
    try {
      await setEmails({ emails: next }).unwrap();
      setBanner({ type: "success", text: "Notification emails updated." });
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string | { msg?: string }[] } })?.data?.detail;
      const text =
        typeof msg === "string"
          ? msg
          : Array.isArray(msg)
            ? msg[0]?.msg ?? "Failed to save"
            : "Failed to save";
      setBanner({ type: "error", text });
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setBanner({ type: "error", text: "That doesn't look like a valid email address." });
      return;
    }
    if (current.includes(value)) {
      setBanner({ type: "error", text: "That email is already on the list." });
      return;
    }
    if (current.length >= MAX_EMAILS) {
      setBanner({ type: "error", text: `You can add up to ${MAX_EMAILS} emails.` });
      return;
    }
    await commit([...current, value]);
    setDraft("");
  }

  async function handleRemove(email: string) {
    await commit(current.filter((e) => e !== email));
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
          @
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Email notifications</h2>
          <p className="text-sm text-gray-500">
            CC extra addresses on AI-escalation emails. Your account email always gets them.
          </p>
        </div>
      </div>

      {banner && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      {current.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-4">
          {current.map((email) => (
            <li
              key={email}
              className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-full pl-3 pr-1 py-1 text-sm text-gray-800"
            >
              <span>{email}</span>
              <button
                type="button"
                onClick={() => handleRemove(email)}
                disabled={saving}
                aria-label={`Remove ${email}`}
                className="w-5 h-5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="alerts@yourcompany.com"
          disabled={current.length >= MAX_EMAILS}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={saving || !draft.trim() || current.length >= MAX_EMAILS}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-2">
        {current.length} / {MAX_EMAILS} addresses added.
      </p>
    </section>
  );
}
```

Note: this component reuses the `Banner` type already defined at the top of the file (`type Banner = ...`), and reuses the `useState` import that's already there. No new imports needed besides the hooks added in Step 1's imports block.

- [ ] **Step 3: Type-check**

```bash
cd /home/knovator/personal/chatbot/apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verify**

Start the web dev server if not already running, then on `/dashboard/integrations`:
1. Scroll below the Slack card → see an empty "Email notifications" card with input + "Add" button, "0 / 5 addresses added".
2. Type `foo@bar` → click Add → error banner "doesn't look like a valid email".
3. Type `test@example.com` → click Add → chip appears, counter is "1 / 5".
4. Add 4 more to reach the cap → Add button and input disable at 5/5.
5. Click × on a chip → chip disappears, counter decrements, Add enables again.
6. Reload the page → chips persist.
7. Trigger an AI escalation (temporarily bad API key on a tenant that has extra emails configured) → verify the CC'd address receives the email (if `RESEND_API_KEY` is real).

- [ ] **Step 5: Stage (do NOT commit)**

```bash
cd /home/knovator/personal/chatbot && git add apps/web/lib/api/integrationsApi.ts apps/web/app/dashboard/integrations/page.tsx
```

---

## Self-Review Checklist (completed)

- **Spec coverage:**
  - Store multiple emails per tenant → Task 1 (JSONB column)
  - Plural (up to 5) → Task 3 (`max_length=MAX_NOTIFICATION_EMAILS`) and Task 4 (UI cap)
  - Account email always gets alerts → Task 2 (CCs are additive, primary stays `tenant.email`)
  - UI on same Integrations page → Task 4 (new card, not new page)
  - No encryption → Emails are not secrets; no Fernet dependency added
- **Type consistency:** `NotificationEmailsConfig.emails: list[EmailStr]` on the Python side becomes `string[]` on the TS side. `useNotificationEmailsQuery` / `useSetNotificationEmailsMutation` match the endpoint shape exactly.
- **No placeholders, no TODOs.**
