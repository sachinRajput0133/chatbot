from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "chatbot",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.embedding_worker"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_routes={
        "app.workers.embedding_worker.*": {"queue": "embeddings"},
    },
    worker_prefetch_multiplier=1,
)
