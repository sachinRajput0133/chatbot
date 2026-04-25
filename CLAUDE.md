## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

## Test Commands

### Playwright (E2E)
Run from `apps/web`:
- `npx playwright test` - Run all tests
- `npx playwright test e2e/billing.spec.ts` - Run specific test
- `npx playwright test --ui` - Open interactive UI
- `npx playwright test --debug` - Run in debug mode (step-by-step)
- `npx playwright show-report` - View last test report

## Payments / Billing

### Gateway Selection
Controlled by `PAYMENT_GATEWAY` in `.env` (root of repo):

```
# razorpay (default) — India tenants → Razorpay, others → Stripe
PAYMENT_GATEWAY=razorpay

# dodo — all tenants use Dodo Payments regardless of country
PAYMENT_GATEWAY=dodo
```

### Dodo Payments env vars
```
DODO_API_KEY=sk_...
DODO_WEBHOOK_SECRET=whsec_...
DODO_STARTER_PRODUCT_ID=prod_...
DODO_GROWTH_PRODUCT_ID=prod_...
DODO_ENTERPRISE_PRODUCT_ID=prod_...
```

### Razorpay env vars (used when PAYMENT_GATEWAY=razorpay and country=IN)
```
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_STARTER_PLAN_ID=plan_...
RAZORPAY_GROWTH_PLAN_ID=plan_...
RAZORPAY_ENTERPRISE_PLAN_ID=plan_...
```

### DB migration (run once after deploy)
```bash
cd apps/api && .venv/bin/alembic upgrade head
```

### Webhook URLs to register
- Razorpay: `POST /api/billing/webhook/razorpay`
- Dodo:     `POST /api/billing/webhook/dodo`
- Stripe:   `POST /api/billing/webhook/stripe`
