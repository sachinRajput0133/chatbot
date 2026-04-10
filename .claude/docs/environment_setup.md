# Environment Setup

## Prerequisites
- Python 3.12
- Node.js 20+ with pnpm
- Docker (for Postgres + Redis)

---

## .env (root — backend reads this)
```env
APP_ENV=development
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql+asyncpg://chatbot:chatbot_secret@localhost:5433/chatbot_db
REDIS_URL=redis://localhost:6380/0

JWT_SECRET_KEY=change-this-to-a-random-secret-key-in-production
GOOGLE_CLIENT_ID=608629646328-v0tn9rv97at9a3ea30n21j4chflka2i3.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>

GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=   # optional

RESEND_API_KEY=re_...   # leave blank to skip emails silently
FROM_EMAIL=noreply@yourdomain.com

PLATFORM_ADMIN_EMAIL=admin@chatbot.platform
PLATFORM_ADMIN_PASSWORD=Admin@SecurePass123

STRIPE_SECRET_KEY=sk_test_...
RAZORPAY_KEY_ID=rzp_test_...
```

## apps/web/.env.local (Next.js MUST read from here — NOT root .env)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=608629646328-v0tn9rv97at9a3ea30n21j4chflka2i3.apps.googleusercontent.com
```

---

## Database / Redis (Docker)
```bash
# Start (from repo root)
docker compose -f docker-compose.dev.yml up -d

# Postgres: localhost:5433, user=chatbot, pass=chatbot_secret, db=chatbot_db
# Redis:    localhost:6380
```

## Backend Setup
```bash
cd apps/api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head
```

## Frontend Setup
```bash
# From repo root
pnpm install
```

---

## Running

```bash
# Start DB + Redis + API (from repo root)
pnpm api
# = docker compose -f docker-compose.dev.yml up -d && cd apps/api && .venv/bin/uvicorn app.main:app --reload --port 8000

# Start frontend (from repo root)
pnpm web
# = cd apps/web && pnpm dev
```

## Useful curl commands
```bash
# Health check
curl http://localhost:8000/health

# Platform config (check platform admin seeded)
curl http://localhost:8000/api/platform/config

# Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@co.com","password":"Test123!","business_name":"Test Co","country":"US"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@co.com","password":"Test123!"}'

# Chat (use bot_id from signup response)
curl -X POST http://localhost:8000/api/chat/<bot_id> \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","visitor_id":"test-1","conversation_id":null,"page_url":"http://localhost"}'
```

## Google OAuth Setup
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit OAuth 2.0 Client: `608629646328-v0tn9rv97at9a3ea30n21j4chflka2i3`
3. Add to **Authorized JavaScript origins**: `http://localhost:3000`
4. Restart Next.js dev server after any `.env.local` change

## Alembic Notes
- Migration file needs `import pgvector.sqlalchemy` at top to avoid NameError
- Run: `cd apps/api && .venv/bin/alembic upgrade head`
