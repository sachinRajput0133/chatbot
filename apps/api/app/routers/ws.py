import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.redis import get_redis, CONV_CHANNEL_PREFIX
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.conversation import WebConversation

router = APIRouter(prefix="/ws", tags=["websocket"])


async def _forward_redis_to_ws(pubsub, websocket: WebSocket):
    """Read messages from Redis pub/sub and forward them to the WebSocket client."""
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode()
            await websocket.send_text(data)


async def _wait_for_ws_disconnect(websocket: WebSocket):
    """Drain any incoming WebSocket frames so disconnects are detected promptly."""
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass


@router.websocket("/{conversation_id}")
async def websocket_chat_endpoint(websocket: WebSocket, conversation_id: str):
    """
    WebSocket endpoint for real-time widget updates via Redis Pub/Sub.
    The widget connects here to receive streaming AI tokens or agent chat messages.
    """
    await websocket.accept()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WebConversation).where(WebConversation.id == conversation_id)
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=1008)
            return

    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"{CONV_CHANNEL_PREFIX}:{conversation_id}"
    await pubsub.subscribe(channel)
    # Give the subscribe command a moment to settle before we start listening
    await asyncio.sleep(0.05)

    listen_task = asyncio.ensure_future(_forward_redis_to_ws(pubsub, websocket))
    disconnect_task = asyncio.ensure_future(_wait_for_ws_disconnect(websocket))

    try:
        await asyncio.wait(
            [listen_task, disconnect_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        listen_task.cancel()
        disconnect_task.cancel()
        await asyncio.gather(listen_task, disconnect_task, return_exceptions=True)
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


@router.websocket("/tenant/{tenant_id}")
async def tenant_dashboard_websocket(websocket: WebSocket, tenant_id: str):
    """
    WebSocket endpoint for real-time dashboard updates.
    The dashboard connects here to receive updates for ALL conversations.
    """
    await websocket.accept()

    from app.core.redis import TENANT_CHANNEL_PREFIX
    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"{TENANT_CHANNEL_PREFIX}:{tenant_id}"
    await pubsub.subscribe(channel)
    await asyncio.sleep(0.05)

    listen_task = asyncio.ensure_future(_forward_redis_to_ws(pubsub, websocket))
    disconnect_task = asyncio.ensure_future(_wait_for_ws_disconnect(websocket))

    try:
        await asyncio.wait(
            [listen_task, disconnect_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    except Exception as e:
        print(f"Tenant WebSocket error: {e}")
    finally:
        listen_task.cancel()
        disconnect_task.cancel()
        await asyncio.gather(listen_task, disconnect_task, return_exceptions=True)
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
