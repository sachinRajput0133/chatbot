"""Serve widget.js — the embeddable chat bubble script."""
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse, Response

router = APIRouter(tags=["static"])

WIDGET_PATH = Path(__file__).parent.parent.parent / "widget_dist" / "widget.js"


@router.get("/widget.js")
async def serve_widget():
    """
    Single widget.js served to all clients.
    Reads window.ChatbotConfig.botId to identify which bot to use.
    """
    if WIDGET_PATH.exists():
        return FileResponse(
            str(WIDGET_PATH),
            media_type="application/javascript",
            headers={"Cache-Control": "no-cache"},
        )
    return Response(
        content="console.warn('[Chatbot] Widget not built yet.');",
        media_type="application/javascript",
    )
