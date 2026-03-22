"""
Celery worker: processes uploaded documents into vector embeddings.
"""
import asyncio
import uuid
from pathlib import Path

import pdfplumber
import docx
from openai import OpenAI

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk, DocumentStatus, DocumentType
from app.services.knowledge_service import _chunk_text
from app.workers.celery_app import celery_app
from sqlalchemy import select

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _extract_text(file_path: str, file_type: DocumentType) -> str:
    if file_type == DocumentType.pdf:
        with pdfplumber.open(file_path) as pdf:
            return "\n\n".join(
                page.extract_text() or "" for page in pdf.pages
            )
    elif file_type == DocumentType.docx:
        doc = docx.Document(file_path)
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    else:  # txt or manual
        return Path(file_path).read_text(encoding="utf-8")


def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed texts using OpenAI text-embedding-3-small."""
    BATCH_SIZE = 100
    embeddings = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=batch,
        )
        embeddings.extend([r.embedding for r in response.data])
    return embeddings


async def _process_document_async(document_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == uuid.UUID(document_id))
        )
        doc = result.scalar_one_or_none()
        if not doc:
            return

        try:
            doc.status = DocumentStatus.processing
            await db.commit()

            # Extract text
            text = _extract_text(doc.file_path, doc.file_type)
            if not text.strip():
                raise ValueError("Document appears to be empty")

            # Chunk
            chunks = _chunk_text(text)
            if not chunks:
                raise ValueError("No chunks produced from document")

            # Embed
            embeddings = _embed_texts(chunks)

            # Delete old chunks if reprocessing
            from sqlalchemy import delete as sql_delete
            await db.execute(
                sql_delete(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
            )

            # Insert new chunks
            for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                chunk = KnowledgeChunk(
                    document_id=doc.id,
                    tenant_id=doc.tenant_id,
                    content=chunk_text,
                    embedding=embedding,
                    chunk_metadata={"index": i, "total": len(chunks)},
                )
                db.add(chunk)

            doc.status = DocumentStatus.indexed
            doc.chunk_count = len(chunks)
            await db.commit()

        except Exception as e:
            doc.status = DocumentStatus.failed
            doc.error_message = str(e)[:500]
            await db.commit()
            raise


@celery_app.task(name="app.workers.embedding_worker.process_document", bind=True, max_retries=2)
def process_document(self, document_id: str):
    """Celery task: extract → chunk → embed a knowledge document."""
    try:
        asyncio.run(_process_document_async(document_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)
