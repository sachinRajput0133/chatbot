import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.redis import (
    get_redis,
    CONV_CHANNEL_PREFIX,
    TENANT_CHANNEL_PREFIX,
    publish_to_conversation,
    publish_to_tenant,
)
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.conversation import WebConversation

router = APIRouter(prefix="/ws", tags=["websocket"])

# Server-side debounce window: re-broadcast the same typing event at most
# once per TYPING_DEBOUNCE_SECONDS per (channel, who).
TYPING_DEBOUNCE_SECONDS = 3.0


async def _forward_redis_to_ws(pubsub, websocket: WebSocket):
    """Read messages from Redis pub/sub and forward them to the WebSocket client."""
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode()
            await websocket.send_text(data)


async def _handle_conv_client_messages(
    websocket: WebSocket, conversation_id: str, tenant_id: str | None
):
    """Read inbound frames from a conversation-scoped WS and process typing events."""
    last_typing: dict[str, float] = {}
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except (ValueError, TypeError):
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("type") != "typing":
                continue
            who = msg.get("who")
            if who not in ("agent", "visitor"):
                continue
            now = time.monotonic()
            if now - last_typing.get(who, 0.0) < TYPING_DEBOUNCE_SECONDS:
                continue
            last_typing[who] = now

            payload = {
                "type": "typing",
                "conversation_id": conversation_id,
                "who": who,
            }
            # Tell the conversation channel (the other party listens here).
            await publish_to_conversation(conversation_id, payload)
            # Also tell the tenant channel so the dashboard list view can
            # surface typing for non-open conversations.
            if tenant_id:
                await publish_to_tenant(tenant_id, payload)
    except (WebSocketDisconnect, Exception):
        pass


async def _handle_tenant_client_messages(websocket: WebSocket, tenant_id: str):
    """Read inbound frames from the tenant dashboard WS and route typing events."""
    last_typing: dict[tuple[str, str], float] = {}
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except (ValueError, TypeError):
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("type") != "typing":
                continue
            who = msg.get("who")
            conv_id = msg.get("conversation_id")
            if who not in ("agent", "visitor") or not conv_id:
                continue
            now = time.monotonic()
            key = (conv_id, who)
            if now - last_typing.get(key, 0.0) < TYPING_DEBOUNCE_SECONDS:
                continue
            last_typing[key] = now

            payload = {
                "type": "typing",
                "conversation_id": conv_id,
                "who": who,
            }
            await publish_to_conversation(conv_id, payload)
            await publish_to_tenant(tenant_id, payload)
    except (WebSocketDisconnect, Exception):
        pass


@router.websocket("/{conversation_id}")
async def websocket_chat_endpoint(websocket: WebSocket, conversation_id: str):
    """
    WebSocket endpoint for real-time widget updates via Redis Pub/Sub.
    The widget connects here to receive streaming AI tokens or agent chat messages.
    """
    await websocket.accept()

    tenant_id: str | None = None
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WebConversation).where(WebConversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            await websocket.close(code=1008)
            return
        tenant_id = str(conv.tenant_id)

    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"{CONV_CHANNEL_PREFIX}:{conversation_id}"
    await pubsub.subscribe(channel)
    # Give the subscribe command a moment to settle before we start listening
    await asyncio.sleep(0.05)

    listen_task = asyncio.ensure_future(_forward_redis_to_ws(pubsub, websocket))
    client_task = asyncio.ensure_future(
        _handle_conv_client_messages(websocket, conversation_id, tenant_id)
    )

    try:
        await asyncio.wait(
            [listen_task, client_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        listen_task.cancel()
        client_task.cancel()
        await asyncio.gather(listen_task, client_task, return_exceptions=True)
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


@router.websocket("/tenant/{tenant_id}")
async def tenant_dashboard_websocket(websocket: WebSocket, tenant_id: str):
    """
    WebSocket endpoint for real-time dashboard updates.
    The dashboard connects here to receive updates for ALL conversations.
    """
    await websocket.accept()

    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"{TENANT_CHANNEL_PREFIX}:{tenant_id}"
    await pubsub.subscribe(channel)
    await asyncio.sleep(0.05)

    listen_task = asyncio.ensure_future(_forward_redis_to_ws(pubsub, websocket))
    client_task = asyncio.ensure_future(
        _handle_tenant_client_messages(websocket, tenant_id)
    )

    try:
        await asyncio.wait(
            [listen_task, client_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    except Exception as e:
        print(f"Tenant WebSocket error: {e}")
    finally:
        listen_task.cancel()
        client_task.cancel()
        await asyncio.gather(listen_task, client_task, return_exceptions=True)
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
