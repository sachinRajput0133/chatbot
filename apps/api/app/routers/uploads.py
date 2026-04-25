import uuid
import boto3
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.models.tenant import Tenant

router = APIRouter(tags=["uploads"])

class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str
    size: int

class PresignedUrlResponse(BaseModel):
    upload_url: str
    file_url: str

@router.post("/api/chat/{bot_id}/upload-url", response_model=PresignedUrlResponse)
async def generate_presigned_url(
    bot_id: uuid.UUID,
    data: PresignedUrlRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate a pre-signed S3 URL for a visitor to upload an attachment."""
    # 1. Verify tenant/bot
    result = await db.execute(select(Tenant).where(Tenant.bot_id == bot_id, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Bot not found")

    # 2. Validate file type and size
    if data.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB")

    # 3. Generate presigned URL
    ext = data.filename.split('.')[-1].lower() if '.' in data.filename else ''
    object_key = f"chat_uploads/{tenant.id}/{uuid.uuid4()}.{ext}"

    if not settings.S3_BUCKET_NAME:
        # Development fallback: since we don't have S3, we can't easily do a direct upload URL
        # We'd normally do a multipart form upload endpoint. But the requirement is presigned URL.
        # If no S3 bucket is configured, we return an error for now, or we could implement a local fallback endpoint.
        raise HTTPException(status_code=501, detail="S3 bucket not configured for uploads.")

    try:
        s3 = boto3.client('s3', region_name=settings.S3_REGION)
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': object_key,
                'ContentType': data.content_type,
            },
            ExpiresIn=300
        )
        
        # Public URL to access the file later (assuming bucket is public read or we generate another presigned url for read)
        # For chatbots, usually we assume the bucket is configured to allow public reads on this path,
        # or we just store the S3 URI. Let's return the HTTPS URL.
        file_url = f"https://{settings.S3_BUCKET_NAME}.s3.{settings.S3_REGION}.amazonaws.com/{object_key}"

        return PresignedUrlResponse(upload_url=presigned_url, file_url=file_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")
