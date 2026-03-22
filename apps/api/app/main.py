from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.routers import auth, knowledge, widget, chat, conversations, analytics, billing, static


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Chatbot SaaS API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Public routes (chat, widget-config) need to allow ALL origins
# because widget.js is embedded on arbitrary client websites.
# We handle per-route CORS via the route decorators below.
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


@app.get("/health")
async def health():
    return {"status": "ok"}
