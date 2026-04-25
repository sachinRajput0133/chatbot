import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.api_key import get_tenant_from_api_key
from app.models.tenant import Tenant
from app.models.conversation import WebConversation

router = APIRouter(prefix="/v1", tags=["Public API"])

@router.get("/conversations")
async def get_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tenant: Tenant = Depends(get_tenant_from_api_key),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch all conversations for the authenticated tenant.
    Requires X-API-Key header.
    """
    query = select(WebConversation).where(
        WebConversation.tenant_id == tenant.id
    ).order_by(desc(WebConversation.created_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    conversations = result.scalars().all()

    return {
        "data": [
            {
                "id": str(c.id),
                "status": c.status,
                "latest_message": c.latest_message,
                "created_at": c.created_at,
                "updated_at": c.updated_at
            }
            for c in conversations
        ],
        "meta": {
            "limit": limit,
            "offset": offset,
            "total_returned": len(conversations)
        }
    }
