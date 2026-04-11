import json
import redis.asyncio as aioredis
from .config import settings

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


# ── Conversation memory ────────────────────────────────────────────────────────

CONV_MEMORY_TTL = 86400  # 24 hours
MAX_HISTORY_MESSAGES = 12


async def get_conversation_history(bot_id: str, visitor_id: str) -> list[dict]:
    r = await get_redis()
    key = f"conv:{bot_id}:{visitor_id}"
    data = await r.get(key)
    return json.loads(data) if data else []


async def append_conversation_message(bot_id: str, visitor_id: str, role: str, content: str):
    r = await get_redis()
    key = f"conv:{bot_id}:{visitor_id}"
    history = await get_conversation_history(bot_id, visitor_id)
    history.append({"role": role, "content": content})
    # Keep last MAX_HISTORY_MESSAGES messages
    history = history[-MAX_HISTORY_MESSAGES:]
    await r.setex(key, CONV_MEMORY_TTL, json.dumps(history))


async def clear_conversation_history(bot_id: str, visitor_id: str):
    r = await get_redis()
    key = f"conv:{bot_id}:{visitor_id}"
    await r.delete(key)


# ── Real-time pub/sub ──────────────────────────────────────────────────────────

CONV_CHANNEL_PREFIX = "chat"


async def publish_to_conversation(conversation_id: str, payload: dict):
    """Publish a message payload to the conversation's Redis pub/sub channel.

    All WebSocket clients subscribed to that conversation will receive it.
    """
    r = await get_redis()
    channel = f"{CONV_CHANNEL_PREFIX}:{conversation_id}"
    await r.publish(channel, json.dumps(payload))

