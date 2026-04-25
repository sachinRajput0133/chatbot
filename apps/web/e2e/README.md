# Playwright end-to-end tests

First batch of E2E tests for the dashboard. Covers login + sidebar nav + the four Integrations cards (Slack, Email notifications, Alert Keywords, WhatsApp).

## Prerequisites

These tests drive the real Next.js app and the real FastAPI backend (with mocks for outbound Slack/Resend/WhatsApp calls). You need:

1. **Postgres + Redis** running. From the repo root:
   ```bash
   pnpm run docker:up
   ```
2. **API** running on `http://localhost:8000` with migrations applied:
   ```bash
   cd apps/api
   .venv/bin/alembic upgrade head
   .venv/bin/uvicorn app.main:app --reload --port 8000
   ```
3. **Web** dev server on `http://localhost:3000` — Playwright's `webServer` config will auto-boot `pnpm run dev` if it's not already up.

## Run

```bash
cd apps/web

# headless (chromium only)
pnpm run test:e2e

# interactive UI mode — best for writing/debugging tests
pnpm run test:e2e:ui

# step-through debugger
pnpm run test:e2e:debug

# open last HTML report
pnpm run test:e2e:report
```

Override the API URL if it's not on the default port:
```bash
E2E_API_URL=http://localhost:8001 pnpm run test:e2e
```

## How it's wired

- `auth.setup.ts` runs first as a Playwright "setup" project. It calls `POST /api/auth/signup` directly to provision a fresh tenant with a unique timestamped email, seeds `localStorage.cb_token` in a browser context, and saves the resulting storage state to `e2e/.auth/owner.json`. Credentials are also written to `e2e/.auth/owner.creds.json` so `auth.spec.ts` can drive the login form with the same account.
- The `chromium` project depends on `setup` and reuses `e2e/.auth/owner.json` so every authenticated spec starts already logged in.
- `auth.spec.ts` overrides `storageState: { cookies: [], origins: [] }` so it starts unauthenticated and exercises the real login form.
- `fixtures.ts` exports `mockSlackTest`, `mockEmailTest`, `mockWhatsAppTest`. Each spec installs the relevant mock with `page.route()` before navigating — that intercepts the API endpoint that fans out to the external service, returning a canned `{ok: true, ...}` payload.

## Selectors

We use accessibility-first selectors (`getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`) — no `data-testid` attrs anywhere in the app yet, and we don't add them in this PR. If a selector turns out to be unstable, the right fix is to add `data-testid` to that one component, not to blanket-tag every component.

## Test data hygiene

Each Playwright run signs up a fresh tenant. Old tenants accumulate in your dev DB — wipe with `docker compose -f docker-compose.dev.yml down -v && pnpm run docker:up && cd apps/api && .venv/bin/alembic upgrade head` if it gets noisy.

## Known scope (and what's deliberately out)

In:
- Login UI flow
- Sidebar nav smoke check
- Slack / Email / Alert Keywords / WhatsApp cards: connect → mutate → test → disconnect

Out (separate PRs):
- CI workflow (`.github/workflows/e2e.yml`) — needs docker-compose orchestration
- Multi-browser (Firefox, WebKit) — 1-line config addition once stable
- Chat widget E2E with mocked AI replies
- Human-takeover (multi-tab WebSocket sync)
- Knowledge upload + RAG retrieval
