## 2026-04-10 — Session memory

### Done
- Full multi-tenant chatbot SaaS built: auth, knowledge upload, RAG pipeline, widget, billing scaffolding
- Auth: JWT + Google OAuth (credential flow via tokeninfo endpoint, no google-auth lib)
- RTK Query structure matching jobApply: baseApi → slices → authApi, knowledgeApi, widgetApi, etc.
- Redux store with authSlice persisting token + user to localStorage (cb_token, cb_user)
- bcrypt direct usage (replaced passlib — Python 3.12 compat)
- razorpay lazy-imported inside _get_razorpay_client() to avoid pkg_resources error
- FastAPI BackgroundTasks for document embedding (no Celery worker needed)
- Platform admin auto-seeded on startup → powers teal help chat bubble (bottom-left)
- HelpChatWidget: pure React, fetches help_bot_id from GET /api/platform/config
- Email service (Resend): send_welcome, send_plan_upgraded, send_plan_cancelled (silent skip if key unset)
- apps/web/.env.local created with NEXT_PUBLIC_GOOGLE_CLIENT_ID for Next.js to read

### Architecture reminders
- Google auth: frontend sends `credential` (ID token JWT) → backend verifies via tokeninfo endpoint
- Embedding worker: no `engine.dispose()` in finally block — kills shared DB engine
- BackgroundTasks: injected in router function signature, not created manually
- RTK Query: all API files import `{ baseApi } from "./baseApi"` and use `baseApi.injectEndpoints()`
- Next.js env: NEXT_PUBLIC_* vars MUST be in apps/web/.env.local, not root .env
- Platform bot: GET /api/platform/config → { help_bot_id: "..." }
- Widget positions: user's bot (bottom-right, indigo), help bot (bottom-left, teal #0d9488)
- pgvector migration: needs `import pgvector.sqlalchemy` at top of alembic migration file

### Pending
- Stripe + Razorpay: need real account keys and price/plan IDs configured
- Resend: need real API key in .env for emails to actually send
- Google OAuth: http://localhost:3000 must be in Authorized JavaScript origins in Google Cloud Console
- JWT_SECRET_KEY: change from placeholder to random secret before production
- Production deployment: Nginx, Docker images, SSL
