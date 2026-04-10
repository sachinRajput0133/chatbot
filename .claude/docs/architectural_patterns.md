# Architectural Patterns

## Backend (FastAPI)

### Multi-Tenant Isolation
Every DB query filters by `tenant_id` extracted from the JWT. Never return cross-tenant data.

```python
# Always scope by tenant
result = await db.execute(
    select(KnowledgeDocument)
    .where(KnowledgeDocument.tenant_id == current_user.tenant_id)
)
```

### RAG Pipeline (Knowledge → Chat)

```
Upload:    POST /api/knowledge/upload
           → KnowledgeDocument row (status=pending)
           → BackgroundTasks.add_task(_process_document_async, doc_id)

Worker:    _process_document_async (embedding_worker.py)
           → parse file (pdfplumber/python-docx/plain text)
           → chunk (500 tokens, 50 overlap)
           → embed each chunk (groq/openai text-embedding)
           → insert KnowledgeChunk rows with pgvector
           → status=indexed

Chat:      POST /api/chat/{bot_id}
           → embed user message
           → pgvector cosine similarity: top 5 chunks WHERE tenant_id=...
           → build prompt: system + chunks + Redis conversation history
           → AI response (Groq/Claude/etc.)
           → store WebMessage rows
           → update message_count_month on Tenant
```

### BackgroundTasks (not Celery)
Embedding runs in FastAPI's BackgroundTasks — no worker process needed.

```python
# In router:
async def upload_document(..., background_tasks: BackgroundTasks):
    doc = KnowledgeDocument(...)
    db.add(doc)
    await db.commit()
    background_tasks.add_task(_process_document_async, str(doc.id))
```

**CRITICAL**: `_process_document_async` must NOT call `engine.dispose()` — it kills the shared engine.

### Google OAuth Flow
```
Frontend:  GoogleLogin component → onSuccess(credentialResponse)
           credentialResponse.credential = Google ID token JWT
Frontend:  POST /api/auth/google { credential: "..." }
Backend:   GET https://oauth2.googleapis.com/tokeninfo?id_token={credential}
           → { sub, email, name, ... }
           → find/create user + tenant
           → return JWT
```

### Platform Admin (Help Chatbot)
Auto-seeded on startup in `main.py` lifespan:
- Tenant: email=`PLATFORM_ADMIN_EMAIL`, plan=enterprise
- WidgetConfig: primary_color=`#0d9488` (teal), position=bottom-left
- User: role=owner, password=`PLATFORM_ADMIN_PASSWORD`

`GET /api/platform/config` → `{ help_bot_id: "<uuid>" }` (public, no auth)

Admin logs in normally at /login and uploads docs via Knowledge Base page.
All users get a teal help bubble powered by this bot.

### Email Service (Resend)
Fire-and-forget. Silent skip if `RESEND_API_KEY` not set.

```python
# In auth_service.py after creating user:
email_service.send_welcome(to=email, business_name=name, bot_id=str(bot_id))
# Does NOT await — runs sync in thread
```

---

## Frontend (Next.js + Redux)

### RTK Query Structure
All API calls use RTK Query. Every API file injects into `baseApi`:

```typescript
// lib/api/baseApi.ts — single source of truth
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Knowledge", "WidgetConfig", "Conversations", "Messages", "Analytics", "Billing", "Profile"],
  endpoints: () => ({}),
});

// lib/api/knowledgeApi.ts
export const knowledgeApi = baseApi.injectEndpoints({ endpoints: (b) => ({
  listDocuments: b.query<...>({ query: () => "/api/knowledge/", ... }),
}) });
```

### Auth State (Redux)
```typescript
// authSlice: token + user persisted to localStorage
dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }))
// localStorage keys: cb_token, cb_user

// parseToken: decodes JWT payload without library
const payload = JSON.parse(atob(token.split(".")[1]));
```

### Providers Hierarchy
```tsx
// app/providers.tsx
<GoogleOAuthProvider clientId={NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
  <Provider store={store}>
    {children}
  </Provider>
</GoogleOAuthProvider>
```

### Widget Positions (no conflict)
| Widget | Component | Position | Color | Who sees it |
|--------|-----------|----------|-------|-------------|
| User's bot preview | `ChatbotWidget` | bottom-right | indigo #6366f1 | Owner only |
| Platform help bot | `HelpChatWidget` | bottom-left | teal #0d9488 | All dashboard users |

---

## Billing Gateway Routing

```
Signup country = "IN"  → Razorpay (UPI, net banking, cards)
All other countries    → Stripe (cards, Apple Pay)
```

Both write to same `subscriptions` table with `gateway: "stripe" | "razorpay"`.

## Plan Limits

| Plan | Messages/mo | Docs |
|------|-------------|------|
| free | 100 | 1 |
| starter | 1,000 | 10 |
| growth | 10,000 | unlimited |
| enterprise | unlimited | unlimited |

Enforced in `POST /api/chat/{bot_id}` via `tenant.message_count_month` check.
