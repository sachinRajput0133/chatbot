# Project Folder Structure

## Root
```
chatbot/
├── apps/
│   ├── api/          ← FastAPI backend (Python 3.12)
│   ├── web/          ← Next.js 14 dashboard frontend
│   └── widget/       ← Vanilla JS widget (esbuild → dist/widget.js)
├── nginx/            ← Reverse proxy config
├── .claude/
│   ├── docs/         ← These docs
│   ├── hooks/        ← session-start.js, post-edit.js
│   └── memory.md     ← Session memory
├── CLAUDE.md
├── docker-compose.dev.yml   ← Postgres (5433) + Redis (6380) only
├── .env              ← All backend env vars
└── pnpm-workspace.yaml
```

---

## Backend `apps/api/`
```
apps/api/
├── app/
│   ├── main.py               ← Lifespan: seed platform admin, register routers
│   ├── core/
│   │   ├── config.py         ← Pydantic Settings (reads .env)
│   │   ├── database.py       ← AsyncEngine + AsyncSessionLocal
│   │   ├── redis.py          ← Redis client (conversation memory TTL 24h)
│   │   └── security.py       ← JWT (create_access_token), bcrypt (hash/verify)
│   ├── models/
│   │   ├── tenant.py         ← Tenant (bot_id UUID, plan, message_count_month)
│   │   ├── user.py           ← User (google_id, role: owner/staff)
│   │   ├── knowledge.py      ← KnowledgeDocument + KnowledgeChunk (pgvector)
│   │   ├── widget.py         ← WidgetConfig (one per tenant)
│   │   ├── conversation.py   ← WebConversation + WebMessage
│   │   ├── subscription.py   ← Subscription (stripe/razorpay)
│   │   └── analytics.py      ← AnalyticsDaily
│   ├── schemas/
│   │   ├── auth.py           ← SignupRequest, LoginRequest, GoogleAuthRequest, MeResponse
│   │   ├── knowledge.py      ← DocumentOut, ManualKnowledgeRequest
│   │   ├── widget.py         ← WidgetConfigOut, WidgetConfigUpdate
│   │   ├── chat.py           ← ChatRequest, ChatResponse
│   │   ├── conversation.py   ← ConversationOut, MessageOut
│   │   ├── analytics.py      ← AnalyticsSummary
│   │   └── billing.py        ← CheckoutRequest, BillingStatusOut
│   ├── routers/
│   │   ├── auth.py           ← /api/auth/*
│   │   ├── knowledge.py      ← /api/knowledge/* (uses BackgroundTasks)
│   │   ├── widget.py         ← /api/widget/*, /api/widget-config/{bot_id}
│   │   ├── chat.py           ← /api/chat/{bot_id} (PUBLIC, any-origin CORS)
│   │   ├── platform.py       ← /api/platform/config (PUBLIC)
│   │   ├── conversations.py  ← /api/conversations/*
│   │   ├── analytics.py      ← /api/analytics/*
│   │   └── billing.py        ← /api/billing/*
│   ├── services/
│   │   ├── auth_service.py       ← signup, login, google_auth (httpx tokeninfo)
│   │   ├── knowledge_service.py  ← chunking + embedding
│   │   ├── chat_service.py       ← RAG query + AI response
│   │   ├── widget_service.py     ← widget config CRUD
│   │   ├── billing_service.py    ← Stripe + Razorpay (lazy import)
│   │   └── email_service.py      ← Resend: welcome, plan_upgraded, plan_cancelled
│   └── workers/
│       └── embedding_worker.py   ← _process_document_async (BackgroundTasks)
├── alembic/
│   └── versions/
│       └── 4f798f3a959e_initial.py   ← needs `import pgvector.sqlalchemy`
├── uploads/
├── requirements.txt
└── .venv/
```

---

## Frontend `apps/web/`
```
apps/web/
├── app/
│   ├── layout.tsx                  ← Root layout wraps with <Providers>
│   ├── providers.tsx               ← GoogleOAuthProvider + Redux Provider
│   ├── (auth)/
│   │   ├── login/page.tsx          ← Email + Google login (RTK Query)
│   │   └── signup/page.tsx         ← Email + Google signup (RTK Query)
│   ├── dashboard/
│   │   ├── layout.tsx              ← Sidebar + ChatbotWidget + HelpChatWidget
│   │   ├── page.tsx                ← Overview
│   │   ├── onboarding/page.tsx     ← 4-step wizard
│   │   ├── knowledge/page.tsx      ← Upload + status polling
│   │   ├── customize/page.tsx      ← Widget appearance + live preview
│   │   ├── embed/page.tsx          ← Script tag copy-paste
│   │   ├── conversations/page.tsx  ← Chat history viewer
│   │   ├── analytics/page.tsx      ← Usage stats
│   │   └── billing/page.tsx        ← Stripe/Razorpay subscription
│   └── components/
│       ├── HelpChatWidget.tsx      ← Teal help bot (bottom-left, platform admin)
│       └── GoogleOAuthProviderWrapper.tsx   ← (legacy, superseded by providers.tsx)
│
├── lib/
│   ├── store.ts                    ← Redux store (baseApi + authReducer)
│   ├── api/
│   │   ├── baseApi.ts              ← createApi with prepareHeaders (JWT)
│   │   ├── authApi.ts              ← signup, login, googleAuth, me
│   │   ├── knowledgeApi.ts         ← upload, list, delete, addManual
│   │   ├── widgetApi.ts            ← getConfig, updateConfig
│   │   ├── conversationsApi.ts     ← list, getMessages
│   │   ├── analyticsApi.ts         ← getSummary
│   │   ├── billingApi.ts           ← status, checkout, cancel
│   │   ├── client.ts               ← Legacy fetch wrapper (used by dashboard pages)
│   │   └── index.ts                ← Barrel export of all hooks
│   └── slices/
│       └── authSlice.ts            ← token, user, tenant (localStorage: cb_token, cb_user)
│
├── .env.local                      ← NEXT_PUBLIC_API_URL + NEXT_PUBLIC_GOOGLE_CLIENT_ID
└── package.json
```

---

## Widget `apps/widget/`
```
apps/widget/
├── src/
│   └── widget.ts     ← TypeScript source
├── dist/
│   └── widget.js     ← Built output (served by FastAPI at GET /widget.js)
└── package.json      ← esbuild for bundling
```

---

## Key Data Flow
```
1. Signup:   POST /api/auth/signup → Tenant + User + WidgetConfig created → welcome email
2. Upload:   POST /api/knowledge/upload → KnowledgeDocument (pending) → BackgroundTask embeds
3. Chat:     POST /api/chat/{bot_id} → embed query → pgvector search → AI reply → store message
4. Widget:   GET /widget.js → reads window.ChatbotConfig.botId → GET /api/widget-config/{bot_id}
5. Billing:  POST /api/billing/create-checkout → Stripe/Razorpay → webhook → update plan
```
