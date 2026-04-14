import os
import uuid
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk, DocumentType, DocumentStatus


CHUNK_SIZE = 500      # approximate tokens (~2000 chars)
CHUNK_OVERLAP = 50    # overlap in tokens (~200 chars)
CHARS_PER_TOKEN = 4


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks by character count."""
    chunk_chars = CHUNK_SIZE * CHARS_PER_TOKEN
    overlap_chars = CHUNK_OVERLAP * CHARS_PER_TOKEN
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_chars
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_chars - overlap_chars
    return chunks


async def save_uploaded_file(file: UploadFile, tenant_id: uuid.UUID) -> tuple[str, DocumentType]:
    """Save upload to S3 (prod) or local disk (dev). Returns (path_or_s3_uri, doc_type)."""
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    type_map = {"pdf": DocumentType.pdf, "txt": DocumentType.txt, "docx": DocumentType.docx}
    doc_type = type_map.get(ext)
    if not doc_type:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB")

    dest_key = f"{tenant_id}/{uuid.uuid4()}.{ext}"

    if settings.S3_BUCKET_NAME:
        import boto3
        import io
        s3 = boto3.client("s3", region_name=settings.S3_REGION)
        s3.upload_fileobj(io.BytesIO(content), settings.S3_BUCKET_NAME, dest_key)
        return f"s3://{settings.S3_BUCKET_NAME}/{dest_key}", doc_type

    # Local disk fallback (development)
    tenant_dir = Path(settings.UPLOAD_DIR) / str(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    file_path = tenant_dir / f"{uuid.uuid4()}.{ext}"
    file_path.write_bytes(content)
    return str(file_path), doc_type


async def create_document_record(
    tenant_id: uuid.UUID,
    filename: str,
    file_path: str,
    doc_type: DocumentType,
    db: AsyncSession,
) -> KnowledgeDocument:
    doc = KnowledgeDocument(
        tenant_id=tenant_id,
        filename=filename,
        file_path=file_path,
        file_type=doc_type,
        status=DocumentStatus.pending,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def create_manual_document(
    tenant_id: uuid.UUID,
    title: str,
    content: str,
    db: AsyncSession,
) -> KnowledgeDocument:
    doc = KnowledgeDocument(
        tenant_id=tenant_id,
        filename=title,
        file_type=DocumentType.manual,
        status=DocumentStatus.pending,
    )
    db.add(doc)
    await db.flush()

    # For manual content, save to a temp file so the worker can process it uniformly
    tenant_dir = Path(settings.UPLOAD_DIR) / str(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    file_path = tenant_dir / f"{doc.id}.txt"
    file_path.write_text(content)
    doc.file_path = str(file_path)

    await db.commit()
    await db.refresh(doc)
    return doc


async def list_documents(tenant_id: uuid.UUID, db: AsyncSession) -> list[KnowledgeDocument]:
    result = await db.execute(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.tenant_id == tenant_id)
        .order_by(KnowledgeDocument.created_at.desc())
    )
    return list(result.scalars().all())


async def get_manual_content(doc_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == doc_id,
            KnowledgeDocument.tenant_id == tenant_id,
            KnowledgeDocument.file_type == DocumentType.manual,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    content = ""
    if doc.file_path and os.path.exists(doc.file_path):
        content = Path(doc.file_path).read_text()

    return {"id": str(doc.id), "title": doc.filename, "content": content}


async def update_manual_document(
    doc_id: uuid.UUID,
    tenant_id: uuid.UUID,
    title: str,
    content: str,
    db: AsyncSession,
) -> KnowledgeDocument:
    result = await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == doc_id,
            KnowledgeDocument.tenant_id == tenant_id,
            KnowledgeDocument.file_type == DocumentType.manual,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.filename = title
    doc.status = DocumentStatus.pending

    if doc.file_path:
        Path(doc.file_path).write_text(content)
    else:
        tenant_dir = Path(settings.UPLOAD_DIR) / str(tenant_id)
        tenant_dir.mkdir(parents=True, exist_ok=True)
        file_path = tenant_dir / f"{doc.id}.txt"
        file_path.write_text(content)
        doc.file_path = str(file_path)

    # Delete old chunks so they get re-embedded
    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
    )
    doc.chunk_count = 0

    await db.commit()
    await db.refresh(doc)
    return doc


async def create_faq_documents(
    tenant_id: uuid.UUID,
    items: list[dict],  # list of {"question": str, "answer": str}
    db: AsyncSession,
) -> list[KnowledgeDocument]:
    """Create one KnowledgeDocument per FAQ item, each stored as a text file."""
    tenant_dir = Path(settings.UPLOAD_DIR) / str(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)

    docs = []
    for item in items:
        question = item["question"].strip()
        answer = item["answer"].strip()
        content = f"Q: {question}\nA: {answer}"

        doc = KnowledgeDocument(
            tenant_id=tenant_id,
            filename=question[:200],  # use question as display name, truncated
            file_type=DocumentType.faq,
            status=DocumentStatus.pending,
        )
        db.add(doc)
        await db.flush()  # get doc.id

        file_path = tenant_dir / f"{doc.id}.txt"
        file_path.write_text(content)
        doc.file_path = str(file_path)

        docs.append(doc)

    await db.commit()
    for doc in docs:
        await db.refresh(doc)
    return docs


async def create_url_document(
    tenant_id: uuid.UUID,
    url: str,
    db: AsyncSession,
) -> KnowledgeDocument:
    """Create a KnowledgeDocument for a URL — the worker will crawl and embed it."""
    doc = KnowledgeDocument(
        tenant_id=tenant_id,
        filename=url[:255],
        file_type=DocumentType.url,
        status=DocumentStatus.pending,
    )
    db.add(doc)
    await db.flush()

    # Store the URL in a temp file so the worker knows what to crawl
    tenant_dir = Path(settings.UPLOAD_DIR) / str(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    url_file = tenant_dir / f"{doc.id}.url"
    url_file.write_text(url)
    doc.file_path = str(url_file)

    await db.commit()
    await db.refresh(doc)
    return doc


async def delete_document(doc_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == doc_id,
            KnowledgeDocument.tenant_id == tenant_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)
    await db.commit()
