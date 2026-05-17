"""Audit log helper — records state-changing admin actions.

Failures here must NEVER break the parent request: callers wrap the .log() call
in their own transaction. We swallow exceptions internally so a missing column
or DB hiccup doesn't take down an invite or role update.
"""
import uuid
import logging
from typing import Any
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def _coerce_uuid(value: Any) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        # First entry is the original client.
        return fwd.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    return ua[:512] if ua else None


async def log(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID | str,
    actor_user_id: uuid.UUID | str | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict | None = None,
    request: Request | None = None,
) -> None:
    """Insert an audit row. Does NOT commit — caller controls the transaction.

    On any error, logs a warning and continues; audit failures must not break
    the user-facing operation.
    """
    try:
        tid = _coerce_uuid(tenant_id)
        if tid is None:
            logger.warning("audit_service.log: invalid tenant_id %r", tenant_id)
            return
        entry = AuditLog(
            tenant_id=tid,
            actor_user_id=_coerce_uuid(actor_user_id),
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            extra_metadata=metadata,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
        )
        db.add(entry)
        await db.flush()
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("audit_service.log failed for action=%s: %s", action, exc)
