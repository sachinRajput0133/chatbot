import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.knowledge import DocumentStatus, DocumentType


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    file_type: DocumentType
    status: DocumentStatus
    chunk_count: int
    error_message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ManualKnowledgeRequest(BaseModel):
    title: str
    content: str
