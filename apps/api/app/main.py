from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.core.security import hash_password
from app.models.tenant import Tenant, Plan
from app.models.user import User, UserRole
from app.models.widget import WidgetConfig
from app.routers import auth, knowledge, widget, chat, conversations, analytics, billing, static
from app.routers import platform as platform_router
from app.routers import lead_capture as lead_capture_router

# ── Rate limiter ───────────────────────────────────────────────────────────────
# Applied per-route with @limiter.limit("N/period") decorator.
# Default 200 req/min applies to any route that doesn't set its own limit.
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


async def _seed_platform_admin():
    """Auto-create the platform admin tenant on first startup."""
    if not settings.PLATFORM_ADMIN_EMAIL or not settings.PLATFORM_ADMIN_PASSWORD:
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Tenant).where(Tenant.email == settings.PLATFORM_ADMIN_EMAIL)
        )
        if result.scalar_one_or_none():
            print(f"[Platform] Admin already exists: {settings.PLATFORM_ADMIN_EMAIL}")
            return

        tenant = Tenant(
            business_name="ChatBot Platform Help",
            email=settings.PLATFORM_ADMIN_EMAIL,
            country="US",
            plan=Plan.enterprise,
        )
        db.add(tenant)
        await db.flush()

        db.add(WidgetConfig(
            tenant_id=tenant.id,
            bot_name="Platform Help",
            primary_color="#0d9488",
            welcome_message="Hi! I can help you set up your chatbot. Ask me anything!",
        ))
        db.add(User(
            tenant_id=tenant.id,
            email=settings.PLATFORM_ADMIN_EMAIL,
            password_hash=hash_password(settings.PLATFORM_ADMIN_PASSWORD),
            role=UserRole.owner,
        ))
        await db.commit()
        print(f"[Platform] Admin seeded: {settings.PLATFORM_ADMIN_EMAIL} (bot_id={tenant.bot_id})")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _seed_platform_admin()
    yield


app = FastAPI(
    title="Chatbot SaaS API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Public routes (chat, widget-config) need to allow ALL origins
# because widget.js is embedded on arbitrary client websites.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(knowledge.router)
app.include_router(widget.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(analytics.router)
app.include_router(billing.router)
app.include_router(static.router)
app.include_router(platform_router.router)
app.include_router(lead_capture_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
