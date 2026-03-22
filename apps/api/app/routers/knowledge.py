import uuid
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.knowledge import DocumentOut, ManualKnowledgeRequest
from app.schemas.auth import TenantOut
from app.services import knowledge_service, auth_service
from app.workers.embedding_worker import process_document

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


async def _get_tenant(user_id: str, db: AsyncSession):
    _, tenant = await auth_service.get_user_with_tenant(user_id, db)
    return tenant


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    file_path, doc_type = await knowledge_service.save_uploaded_file(file, tenant.id)
    doc = await knowledge_service.create_document_record(
        tenant_id=tenant.id,
        filename=file.filename or "upload",
        file_path=file_path,
        doc_type=doc_type,
        db=db,
    )
    # Trigger Celery worker
    process_document.delay(str(doc.id))
    return doc


@router.post("/manual", response_model=DocumentOut)
async def add_manual_knowledge(
    data: ManualKnowledgeRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    doc = await knowledge_service.create_manual_document(
        tenant_id=tenant.id,
        title=data.title,
        content=data.content,
        db=db,
    )
    process_document.delay(str(doc.id))
    return doc


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    return await knowledge_service.list_documents(tenant.id, db)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(user_id, db)
    await knowledge_service.delete_document(doc_id, tenant.id, db)
