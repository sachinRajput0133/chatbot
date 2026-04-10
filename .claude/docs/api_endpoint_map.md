# API Endpoint Map

Base URL: `http://localhost:8000`
All dashboard frontend calls go via RTK Query with `baseUrl: process.env.NEXT_PUBLIC_API_URL`.

---

## Auth `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | None | Email signup → creates tenant + user + widget config |
| POST | `/api/auth/login` | None | Email login → JWT |
| POST | `/api/auth/google` | None | Google OAuth (credential = ID token JWT from GoogleLogin) |
| GET | `/api/auth/me` | Bearer | Current user + tenant info |

### Signup body
```json
{ "business_name": "Acme", "email": "a@b.com", "password": "Min8chars", "country": "IN" }
```

### Google auth body
```json
{ "credential": "<google-id-token-jwt>", "country": "US", "business_name": "My Biz" }
```

### Token response
```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```
JWT payload: `{ sub: user_id, tenant_id, role, email, exp }`

---

## Knowledge `/api/knowledge`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/knowledge/upload` | Bearer | Upload PDF/TXT/DOCX → triggers background embedding |
| POST | `/api/knowledge/manual` | Bearer | Add manual text entry |
| GET | `/api/knowledge/` | Bearer | List all documents with status |
| DELETE | `/api/knowledge/{id}` | Bearer | Delete document + chunks |

### Document statuses: `pending` → `processing` → `indexed` | `failed`
Embedding runs via FastAPI BackgroundTasks (no Celery needed).

---

## Widget `/api/widget`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/widget/config` | Bearer | Get widget appearance settings |
| PUT | `/api/widget/config` | Bearer | Update bot_name, primary_color, welcome_message, position |
| GET | `/api/widget-config/{bot_id}` | None (public) | Widget fetches own config by bot_id |

---

## Chat `/api/chat` (PUBLIC — any origin CORS)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/{bot_id}` | None | RAG chat: embed query → pgvector search → AI reply |

### Chat body
```json
{
  "message": "How do I embed the chatbot?",
  "visitor_id": "uuid-from-localstorage",
  "conversation_id": null,
  "page_url": "https://client-site.com/contact"
}
```

### Chat response
```json
{ "reply": "...", "conversation_id": "<uuid>" }
```

---

## Platform `/api/platform` (PUBLIC)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/platform/config` | None | Returns help_bot_id for dashboard help widget |

---

## Conversations `/api/conversations`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/conversations/` | Bearer | Paginated list (limit/offset) |
| GET | `/api/conversations/{id}/messages` | Bearer | Messages in a conversation |

---

## Analytics `/api/analytics`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/summary` | Bearer | message_count_month, conversations count, top pages |

---

## Billing `/api/billing`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/billing/create-checkout` | Bearer | Stripe checkout session |
| POST | `/api/billing/create-razorpay-subscription` | Bearer | Razorpay subscription (India) |
| POST | `/api/billing/webhook` | None (sig verify) | Stripe webhook |
| POST | `/api/billing/razorpay-webhook` | None (sig verify) | Razorpay webhook |
| GET | `/api/billing/status` | Bearer | Current plan + subscription info |
| POST | `/api/billing/cancel` | Bearer | Cancel subscription |

---

## Static

| Path | Description |
|------|-------------|
| `GET /widget.js` | Vanilla JS widget bundle (served from apps/widget/dist/) |
| `GET /health` | `{ "status": "ok" }` |
