import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import handle_chat

router = APIRouter(tags=["chat"])


@router.post("/api/chat/{bot_id}", response_model=ChatResponse)
async def chat(
    bot_id: uuid.UUID,
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — called by widget.js on every message.
    CORS is open (any origin) — configured in main.py.
    """
    reply, conversation_id = await handle_chat(
        bot_id=bot_id,
        message=data.message,
        visitor_id=data.visitor_id,
        conversation_id=data.conversation_id,
        page_url=data.page_url,
        db=db,
        user_info=data.user_info,
    )
    return ChatResponse(reply=reply, conversation_id=conversation_id)
