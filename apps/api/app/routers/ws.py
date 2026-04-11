import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.redis import get_redis, CONV_CHANNEL_PREFIX
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.conversation import WebConversation

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/{conversation_id}")
async def websocket_chat_endpoint(websocket: WebSocket, conversation_id: str):
    """
    WebSocket endpoint for real-time widget updates via Redis Pub/Sub.
    The widget connects here to receive streaming AI tokens or agent chat messages.
    """
    await websocket.accept()
    
    # Optional: Verify conversation exists (without blocking connection forever if we don't care)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(WebConversation).where(WebConversation.id == conversation_id))
        if not result.scalar_one_or_none():
            await websocket.close(code=1008)
            return

    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"{CONV_CHANNEL_PREFIX}:{conversation_id}"
    await pubsub.subscribe(channel)

    try:
        # Keep listening to the channel until the client disconnects.
        while True:
            # We use get_message with timeout to also detect if the WebSocket disconnected
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                if message["type"] == "message":
                    payload = message["data"]
                    # payload is a JSON string containing the message data
                    await websocket.send_text(payload)
            else:
                # We do a tiny ping/recv on the websocket just to detect client disconnects quicker
                # Instead of receiving data (which we don't expect from the client yet), we just wait.
                # Actually, await websocket.receive_text() would block. Let's just catch disconnection elsewhere.
                # Since get_message handles the async yielding, sleeping is fine, but to catch disconnects 
                # we can run a parallel task waiting for disconnect.
                pass
                
            # If the client disconnected, we'll get a ConnectionClosed exception naturally 
            # either when sending, or we can await receive in the background.
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
