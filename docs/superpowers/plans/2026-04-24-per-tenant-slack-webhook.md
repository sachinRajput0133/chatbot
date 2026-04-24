# Per-Tenant Slack Webhook Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each tenant configure their own Slack incoming-webhook URL in the dashboard so AI-escalation alerts go to *their* Slack workspace, not a single global one.

**Architecture:**
- Add an encrypted `slack_webhook_url` column to `tenants` (Fernet, key from new `ENCRYPTION_KEY` env var).
- Replace the global `SLACK_WEBHOOK_URL` reader in `notify_slack_escalation()` with an explicit `webhook_url` parameter; `_escalate_to_human()` decrypts the tenant's URL and passes it in.
- New `/api/integrations/slack` router (GET/PUT/DELETE + POST test) with masked reads.
- New `/dashboard/integrations` Next.js page using a new RTK Query slice.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Pydantic v2, `cryptography.fernet` (already transitively installed via `python-jose[cryptography]`), Next.js 14 app-router, RTK Query, Redux Toolkit, Tailwind.

**Testing note:** This repo has no pytest infrastructure. Each task uses manual verification (curl, python REPL, or browser clicks) instead of automated tests, consistent with the existing codebase. If/when tests are added later, the service-layer functions in Task 1 and Task 3 are the natural seams.

---

## File Structure

**Create:**
- `apps/api/app/core/encryption.py` — Fernet encrypt/decrypt helpers
- `apps/api/alembic/versions/i4j5k6l7m8n9_add_slack_webhook_to_tenants.py` — migration
- `apps/api/app/schemas/integrations.py` — request/response models
- `apps/api/app/routers/integrations.py` — CRUD + test endpoints
- `apps/web/lib/api/integrationsApi.ts` — RTK Query slice
- `apps/web/app/dashboard/integrations/page.tsx` — settings UI

**Modify:**
- `apps/api/app/core/config.py` — add `ENCRYPTION_KEY`
- `apps/api/app/models/tenant.py` — add `slack_webhook_url` column
- `apps/api/app/services/email_service.py` — change `notify_slack_escalation` signature to take explicit `webhook_url`
- `apps/api/app/services/chat_service.py` — decrypt tenant webhook, pass to notifier
- `apps/api/app/main.py` — register integrations router
- `apps/web/lib/api/baseApi.ts` — add `"Integrations"` tag
- `apps/web/lib/api/index.ts` — export new slice
- `apps/web/app/dashboard/layout.tsx` — add nav entry
- `.env.example` (if exists; otherwise skip) — document `ENCRYPTION_KEY`

---

## Task 1: Encryption Utility

**Files:**
- Create: `apps/api/app/core/encryption.py`
- Modify: `apps/api/app/core/config.py` (lines around 24-28, Auth section)

- [ ] **Step 1: Add `ENCRYPTION_KEY` to Settings**

Edit `apps/api/app/core/config.py`. Under the Auth section, add:

```python
    # Fernet key for encrypting per-tenant secrets (Slack webhooks, future OAuth tokens).
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = ""
```

Place it right after `ACCESS_TOKEN_EXPIRE_MINUTES` so it sits with the other secret-type settings.

- [ ] **Step 2: Create encryption helper**

Create `apps/api/app/core/encryption.py`:

```python
"""
Fernet-based encryption for tenant-level secrets (Slack webhooks, etc.).
Fails loudly if ENCRYPTION_KEY is missing — these values are not optional at rest.
"""
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings


class EncryptionNotConfigured(RuntimeError):
    """Raised when ENCRYPTION_KEY is unset and a caller tries to encrypt/decrypt."""


def _fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        raise EncryptionNotConfigured(
            "ENCRYPTION_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
            "and add it to your .env."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a short secret (webhook URL, token). Returns base64-encoded ciphertext."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a value produced by encrypt_secret. Raises InvalidToken on tamper/wrong key."""
    return _fernet().decrypt(ciphertext.encode()).decode()


__all__ = ["encrypt_secret", "decrypt_secret", "EncryptionNotConfigured", "InvalidToken"]
```

- [ ] **Step 3: Generate a dev `ENCRYPTION_KEY` and add it to `.env`**

Run:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output and append to `/home/knovator/personal/chatbot/.env`:

```
ENCRYPTION_KEY=<paste-generated-key>
```

- [ ] **Step 4: Smoke-test the helper**

From the API venv:

```bash
cd apps/api && .venv/bin/python -c "
from app.core.encryption import encrypt_secret, decrypt_secret
c = encrypt_secret('https://hooks.slack.com/services/AAA/BBB/ccc')
print('enc:', c)
print('dec:', decrypt_secret(c))
"
```

Expected: prints a long base64 string for `enc:` and the original URL for `dec:`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/encryption.py apps/api/app/core/config.py
git commit -m "feat(api): add Fernet encryption helper for tenant secrets"
```

---

## Task 2: DB Column + Migration

**Files:**
- Modify: `apps/api/app/models/tenant.py` (after line 36, near the payment-provider IDs)
- Create: `apps/api/alembic/versions/i4j5k6l7m8n9_add_slack_webhook_to_tenants.py`

- [ ] **Step 1: Add column to `Tenant` model**

Edit `apps/api/app/models/tenant.py`. After the `razorpay_customer_id` line (currently line 36), insert:

```python
    # Per-tenant Slack incoming-webhook URL, Fernet-encrypted at rest.
    # Null = tenant has not configured Slack.
    slack_webhook_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
```

Use `String(512)` — Fernet ciphertext of a 77-char Slack URL is ~200 chars; 512 leaves headroom.

- [ ] **Step 2: Create the migration file**

Create `apps/api/alembic/versions/i4j5k6l7m8n9_add_slack_webhook_to_tenants.py`:

```python
"""add slack_webhook_url to tenants

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-04-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'i4j5k6l7m8n9'
down_revision = 'h3i4j5k6l7m8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('slack_webhook_url', sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'slack_webhook_url')
```

- [ ] **Step 3: Apply the migration**

```bash
cd apps/api && .venv/bin/alembic upgrade head
```

Expected: prints `Running upgrade h3i4j5k6l7m8 -> i4j5k6l7m8n9, add slack_webhook_url to tenants`.

- [ ] **Step 4: Verify the column exists**

```bash
cd apps/api && .venv/bin/python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' AND column_name='slack_webhook_url'\"))
        print(r.fetchall())
asyncio.run(main())
"
```

Expected: `[('slack_webhook_url', 'character varying')]`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/models/tenant.py apps/api/alembic/versions/i4j5k6l7m8n9_add_slack_webhook_to_tenants.py
git commit -m "feat(db): add slack_webhook_url column to tenants"
```

---

## Task 3: Service-Layer Refactor

**Files:**
- Modify: `apps/api/app/services/email_service.py` (lines 206-264, `notify_slack_escalation`)
- Modify: `apps/api/app/services/chat_service.py` (lines 437-461, `_notify` in `_escalate_to_human`)

- [ ] **Step 1: Change `notify_slack_escalation` to take explicit `webhook_url`**

In `apps/api/app/services/email_service.py`, replace the function signature and the URL lookup. The current function reads `settings.SLACK_WEBHOOK_URL`; change it so the caller supplies the URL.

Replace lines 206-218 (the signature through the `if not url: return` check) with:

```python
def notify_slack_escalation(
    *,
    webhook_url: str | None,
    business_name: str,
    conversation_id: str,
    visitor_name: str | None,
    visitor_email: str | None,
    visitor_message: str,
    error_detail: str,
) -> None:
    """Post an AI-failure alert to a tenant's Slack incoming webhook (if one is configured)."""
    if not webhook_url:
        return
```

Then in the function body, replace `url` with `webhook_url` in the `client.post(url, ...)` call (around line 261):

```python
            client.post(webhook_url, json=payload)
```

Leave the rest of the payload-building code unchanged.

- [ ] **Step 2: Remove the now-unused `settings.SLACK_WEBHOOK_URL` reference**

Still in `apps/api/app/services/email_service.py`, confirm `settings.SLACK_WEBHOOK_URL` no longer appears in the file (grep to confirm). The old `url = settings.SLACK_WEBHOOK_URL` line is gone as part of Step 1. Leave `settings.SLACK_WEBHOOK_URL` in `config.py` for now (it's still allowed as a fallback for platform-owner alerts if someone wants it; we simply stop reading it here).

Run:

```bash
grep -n "SLACK_WEBHOOK_URL" apps/api/app/services/email_service.py
```

Expected: no output.

- [ ] **Step 3: Update `chat_service._escalate_to_human` to decrypt and pass the tenant's URL**

In `apps/api/app/services/chat_service.py`, edit the `_notify` inner function (around lines 437-461). Before the `asyncio.to_thread(email_service.notify_slack_escalation, ...)` call, decrypt the tenant's webhook. Replace the existing `_notify` block:

```python
    async def _notify() -> None:
        try:
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

            # Decrypt the tenant's Slack webhook if configured. Corrupted/unreadable
            # ciphertext is treated as "not configured" rather than crashing the alert.
            slack_url: str | None = None
            if tenant.slack_webhook_url:
                try:
                    from app.core.encryption import decrypt_secret, InvalidToken
                    slack_url = decrypt_secret(tenant.slack_webhook_url)
                except InvalidToken:
                    logger.warning(
                        f"[AI Escalation] Tenant {tenant.id} has an unreadable slack_webhook_url — skipping Slack alert"
                    )

            await asyncio.to_thread(
                email_service.notify_slack_escalation,
                webhook_url=slack_url,
                business_name=tenant.business_name,
                conversation_id=str(conv.id),
                visitor_name=conv.visitor_name,
                visitor_email=conv.visitor_email,
                visitor_message=visitor_message,
                error_detail=error_detail,
            )
        except Exception as e:
            logger.warning(f"[AI Escalation] Notification failed: {e}")
```

- [ ] **Step 4: Restart the API and do a syntax-only sanity check**

```bash
cd apps/api && .venv/bin/python -c "from app.services import email_service, chat_service; print('ok')"
```

Expected: prints `ok`. Any import-time error here means a typo in Step 1 or Step 3.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/email_service.py apps/api/app/services/chat_service.py
git commit -m "refactor(api): make slack escalation per-tenant via explicit webhook arg"
```

---

## Task 4: Request / Response Schemas

**Files:**
- Create: `apps/api/app/schemas/integrations.py`

- [ ] **Step 1: Write the schema module**

Create `apps/api/app/schemas/integrations.py`:

```python
from pydantic import BaseModel, Field, field_validator


SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/services/"


class SlackIntegrationStatus(BaseModel):
    """Safe read-side view — never exposes the full URL."""
    configured: bool
    masked_url: str | None = None  # e.g. "hooks.slack.com/services/T01/…/abc1234"


class SetSlackWebhookRequest(BaseModel):
    webhook_url: str = Field(..., min_length=len(SLACK_WEBHOOK_PREFIX) + 10, max_length=300)

    @field_validator("webhook_url")
    @classmethod
    def _must_be_slack(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(SLACK_WEBHOOK_PREFIX):
            raise ValueError(
                f"webhook_url must start with {SLACK_WEBHOOK_PREFIX}"
            )
        return v


class TestSlackRequest(BaseModel):
    """Optional override — if omitted, tests the stored URL."""
    webhook_url: str | None = None


class TestSlackResponse(BaseModel):
    ok: bool
    detail: str | None = None
```

- [ ] **Step 2: Verify it imports**

```bash
cd apps/api && .venv/bin/python -c "from app.schemas.integrations import SlackIntegrationStatus, SetSlackWebhookRequest; print(SetSlackWebhookRequest.model_json_schema()['properties']['webhook_url'])"
```

Expected: prints a JSON-schema dict with `minLength`, `maxLength`, `title`, `type: string`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/schemas/integrations.py
git commit -m "feat(api): add integrations schemas (slack webhook status, set, test)"
```

---

## Task 5: Integrations Router

**Files:**
- Create: `apps/api/app/routers/integrations.py`
- Modify: `apps/api/app/main.py` (import + `include_router`)

- [ ] **Step 1: Write the router**

Create `apps/api/app/routers/integrations.py`:

```python
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
)

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
```

- [ ] **Step 2: Register the router in `main.py`**

Edit `apps/api/app/main.py`. Update the import line (line 19) to include `integrations`:

```python
from app.routers import auth, knowledge, widget, chat, conversations, analytics, billing, static, ws, integrations
```

Then after the existing `app.include_router(...)` block (after line 106, the `ws.router` line), add:

```python
app.include_router(integrations.router)
```

- [ ] **Step 3: Restart the API and verify routes exist**

Start the API (or check it's running), then:

```bash
curl -s http://localhost:8000/openapi.json | python3 -c "import sys, json; paths = json.load(sys.stdin)['paths']; print([p for p in paths if '/integrations/' in p])"
```

Expected: `['/api/integrations/slack', '/api/integrations/slack/test']`.

- [ ] **Step 4: Manual smoke test with curl**

Log in via the UI (or any `/api/auth/login` call) to get a JWT, then export it:

```bash
export TOKEN="<paste jwt here>"

# status — should be not configured
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/integrations/slack

# set — use a real webhook from your Slack test workspace OR skip to the next task
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"webhook_url":"https://hooks.slack.com/services/T000/B000/XXXXXXXXXXXXXXXXXXXX"}' \
  http://localhost:8000/api/integrations/slack

# status — should now show masked
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/integrations/slack

# delete
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/integrations/slack
```

Expected first call: `{"configured":false,"masked_url":null}`.
Expected after PUT: `{"configured":true,"masked_url":"hooks.slack.com/services/T000/…/XXXXXXX"}`.
Expected DELETE: HTTP 204 (no body).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/integrations.py apps/api/app/main.py
git commit -m "feat(api): add per-tenant /api/integrations/slack endpoints"
```

---

## Task 6: Frontend RTK Query Slice

**Files:**
- Modify: `apps/web/lib/api/baseApi.ts` (line 14, tagTypes array)
- Create: `apps/web/lib/api/integrationsApi.ts`
- Modify: `apps/web/lib/api/index.ts` (add export)

- [ ] **Step 1: Add `"Integrations"` tag**

Edit `apps/web/lib/api/baseApi.ts` line 14. Replace:

```typescript
  tagTypes: ["Knowledge", "WidgetConfig", "Conversations", "Messages", "Analytics", "Billing", "Profile"],
```

with:

```typescript
  tagTypes: ["Knowledge", "WidgetConfig", "Conversations", "Messages", "Analytics", "Billing", "Profile", "Integrations"],
```

- [ ] **Step 2: Create the API slice**

Create `apps/web/lib/api/integrationsApi.ts`:

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
  }),
});

export const {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
} = integrationsApi;
```

- [ ] **Step 3: Export the slice from the barrel file**

Edit `apps/web/lib/api/index.ts`. Add at the bottom:

```typescript
export * from "./integrationsApi";
```

- [ ] **Step 4: Verify the Next.js dev server still type-checks**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors introduced by the new files.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api/baseApi.ts apps/web/lib/api/integrationsApi.ts apps/web/lib/api/index.ts
git commit -m "feat(web): add integrationsApi RTK Query slice"
```

---

## Task 7: Dashboard UI — Integrations Page

**Files:**
- Create: `apps/web/app/dashboard/integrations/page.tsx`
- Modify: `apps/web/app/dashboard/layout.tsx` (NAV array, around line 11-21)

- [ ] **Step 1: Add the nav entry**

Edit `apps/web/app/dashboard/layout.tsx`. In the `NAV` array (currently lines 11-21), insert a new entry between `Analytics` and `Billing`:

```typescript
  { href: "/dashboard/integrations", label: "Integrations", icon: "hub" },
```

Result:

```typescript
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "psychology" },
  { href: "/dashboard/customize", label: "Customize Bot", icon: "tune" },
  { href: "/dashboard/goals", label: "Bot Goals", icon: "track_changes" },
  { href: "/dashboard/embed", label: "Embed Code", icon: "code" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "forum" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "insights" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "hub" },
  { href: "/dashboard/billing", label: "Billing", icon: "payments" },
  { href: "/dashboard/profile", label: "Profile", icon: "account_circle" },
];
```

- [ ] **Step 2: Write the page**

Create `apps/web/app/dashboard/integrations/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
} from "@/lib/api";

type Banner = { type: "success" | "error"; text: string } | null;

export default function IntegrationsPage() {
  const { data: status, isLoading } = useSlackStatusQuery();
  const [setWebhook, { isLoading: saving }] = useSetSlackWebhookMutation();
  const [deleteWebhook, { isLoading: deleting }] = useDeleteSlackWebhookMutation();
  const [testWebhook, { isLoading: testing }] = useTestSlackWebhookMutation();

  const [url, setUrl] = useState("");
  const [banner, setBanner] = useState<Banner>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    try {
      await setWebhook({ webhook_url: url.trim() }).unwrap();
      setBanner({ type: "success", text: "Slack webhook saved." });
      setUrl("");
    } catch (err: unknown) {
      const msg =
        (err as { data?: { detail?: string | { msg?: string }[] } })?.data?.detail;
      const text =
        typeof msg === "string"
          ? msg
          : Array.isArray(msg)
            ? msg[0]?.msg ?? "Failed to save"
            : "Failed to save";
      setBanner({ type: "error", text });
    }
  }

  async function handleTest(useTyped: boolean) {
    setBanner(null);
    try {
      const body = useTyped ? { webhook_url: url.trim() } : {};
      const result = await testWebhook(body).unwrap();
      if (result.ok) {
        setBanner({ type: "success", text: "Test message sent — check your Slack channel." });
      } else {
        setBanner({ type: "error", text: result.detail ?? "Slack rejected the test message." });
      }
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? "Test failed";
      setBanner({ type: "error", text: msg });
    }
  }

  async function handleDisconnect() {
    setBanner(null);
    if (!confirm("Disconnect Slack? Future AI-escalation alerts will only be emailed.")) return;
    try {
      await deleteWebhook().unwrap();
      setBanner({ type: "success", text: "Slack disconnected." });
    } catch {
      setBanner({ type: "error", text: "Failed to disconnect." });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Integrations</h1>
      <p className="text-gray-500 mb-8">
        Connect your team&apos;s tools to get notified when your chatbot needs human help.
      </p>

      {banner && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#4A154B] text-white flex items-center justify-center font-bold">
            S
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Slack</h2>
            <p className="text-sm text-gray-500">
              Get a Slack alert when the AI can&apos;t reply to a visitor.
            </p>
          </div>
        </div>

        {status?.configured ? (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Connected webhook</div>
                <code className="text-sm text-gray-800 font-mono">{status.masked_url}</code>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTest(false)}
                disabled={testing}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {testing ? "Sending..." : "Send test message"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {deleting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slack incoming-webhook URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T000/B000/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Create one at{" "}
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  api.slack.com/messaging/webhooks
                </a>
                . Pick the channel alerts should go to.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !url.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => handleTest(true)}
                disabled={testing || !url.trim().startsWith("https://hooks.slack.com/services/")}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test without saving"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Run the web dev server and manually verify the page**

```bash
cd apps/web && npm run dev
```

Then in a browser:
1. Log in to the dashboard.
2. Confirm "Integrations" appears in the sidebar with the `hub` icon.
3. Click into it; initial state shows the form with an empty input.
4. Paste a test Slack webhook URL → click "Test without saving" → confirm the test message lands in Slack.
5. Click "Save" → page updates to show masked URL, "Connected" badge, and "Send test message" / "Disconnect" buttons.
6. Click "Send test message" → Slack gets another test message.
7. Click "Disconnect" → page flips back to the form state.

- [ ] **Step 4: End-to-end escalation smoke test**

Trigger an AI escalation against a tenant that has Slack configured. The easiest path: temporarily set an invalid `ANTHROPIC_API_KEY` (or whichever provider the tenant is using) to force the AI call to fail, then send a message from the widget. Expected:
- Email lands in the tenant's inbox (if `RESEND_API_KEY` is set).
- Slack message lands in the channel wired to the webhook.
- Dashboard conversation flips to human mode.

Restore the API key after.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/dashboard/integrations/page.tsx apps/web/app/dashboard/layout.tsx
git commit -m "feat(web): add Integrations dashboard page for per-tenant Slack webhook"
```

---

## Task 8: Documentation & Env Example

**Files:**
- Modify: `.env.example` if it exists; otherwise create one short note in `docs/ai-escalation.md`

- [ ] **Step 1: Check for an `.env.example` file**

```bash
ls -la .env.example 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- [ ] **Step 2a: If `.env.example` exists, add the encryption key entry**

Append:

```
# Fernet key for encrypting tenant secrets (Slack webhooks, etc.).
# Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=
```

- [ ] **Step 2b: If `.env.example` does not exist, update the docs instead**

Append a short section to `docs/ai-escalation.md`:

```markdown
## Slack integration (per-tenant)

Each tenant can configure their own Slack incoming-webhook URL at
**Dashboard → Integrations → Slack**. The URL is stored Fernet-encrypted in
the `tenants.slack_webhook_url` column.

Required env var for the API:

```
# Generate with:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=<base64-fernet-key>
```

Rotating `ENCRYPTION_KEY` invalidates all stored webhooks — tenants will need
to re-save them from the dashboard.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: document ENCRYPTION_KEY and per-tenant Slack integration"
```

---

## Self-Review Checklist (completed)

- **Spec coverage:**
  - Per-tenant Slack URL stored on tenant → Task 2
  - Encrypted at rest → Task 1 + Task 2
  - Dashboard UI to configure → Task 7
  - API to read/set/delete → Task 5
  - Test-before-save button → Task 5 (accepts URL in body) + Task 7
  - Escalation uses tenant's URL not global → Task 3
  - Rate-limited test endpoint → Task 5 (`5/minute`)
  - Masked URL in responses → Task 5 `_mask()`
- **No placeholders:** every code block is complete; no "TODO" or "similar to Task N" left.
- **Type consistency:** `SlackIntegrationStatus` (fields `configured`, `masked_url`) matches the TS interface; `notify_slack_escalation(webhook_url=...)` signature matches the call site in `chat_service._notify`; `TestSlackResponse { ok, detail }` matches TS `TestSlackResponse`.
- **Execution order:** Encryption → DB → service refactor → schemas → router → frontend slice → UI → docs. Each task leaves the tree in a compiling, runnable state.
