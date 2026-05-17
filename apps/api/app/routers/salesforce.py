"""
Salesforce native CRM integration endpoints.

Separate router (under the /api/integrations prefix) to keep merge-friendly
diff isolation from the parallel HubSpot integration touching the shared
integrations.py file.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import encrypt_secret, decrypt_secret, InvalidToken
from app.core.rbac import require_permission
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.integrations import (
    SalesforceIntegrationStatus,
    SetSalesforceConfigRequest,
    TestSalesforceResponse,
)
from app.services import salesforce_service
from app.services.salesforce_service import SalesforceCreds, SalesforceError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations", tags=["integrations"])
limiter = Limiter(key_func=get_remote_address)


async def _get_tenant_for_user(user_id: str, db: AsyncSession) -> Tenant:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    tenant = (await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _decrypt_salesforce_creds(tenant: Tenant) -> SalesforceCreds | None:
    """Return decrypted creds or None if not fully configured / unreadable."""
    if not (
        tenant.salesforce_client_id
        and tenant.salesforce_client_secret
        and tenant.salesforce_username
        and tenant.salesforce_password
    ):
        return None
    try:
        return SalesforceCreds(
            client_id=decrypt_secret(tenant.salesforce_client_id),
            client_secret=decrypt_secret(tenant.salesforce_client_secret),
            username=decrypt_secret(tenant.salesforce_username),
            password=decrypt_secret(tenant.salesforce_password),
        )
    except InvalidToken:
        logger.warning(f"[Salesforce] Unreadable creds for tenant {tenant.id}")
        return None


@router.get("/salesforce", response_model=SalesforceIntegrationStatus)
async def get_salesforce_status(
    user_id: str = Depends(require_permission("integrations", "view")),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    creds = _decrypt_salesforce_creds(tenant)
    if creds is None:
        return SalesforceIntegrationStatus(connected=False)
    return SalesforceIntegrationStatus(
        connected=True,
        instance_url=tenant.salesforce_instance_url,
    )


@router.post("/salesforce", response_model=SalesforceIntegrationStatus)
@limiter.limit("5/minute")
async def set_salesforce_config(
    request: Request,
    data: SetSalesforceConfigRequest,
    user_id: str = Depends(require_permission("integrations", "manage")),
    db: AsyncSession = Depends(get_db),
):
    """Validate credentials by logging in, then encrypt + persist."""
    tenant = await _get_tenant_for_user(user_id, db)
    creds = SalesforceCreds(
        client_id=data.client_id.strip(),
        client_secret=data.client_secret.strip(),
        username=data.username.strip(),
        password=data.password,  # do not strip — password+token may have meaningful trailing chars
    )
    try:
        info = await salesforce_service.test_connection(creds)
    except SalesforceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Salesforce] Unexpected validation error for tenant {tenant.id}: {e}")
        raise HTTPException(status_code=400, detail=f"Could not reach Salesforce: {e}")

    tenant.salesforce_client_id = encrypt_secret(creds.client_id)
    tenant.salesforce_client_secret = encrypt_secret(creds.client_secret)
    tenant.salesforce_username = encrypt_secret(creds.username)
    tenant.salesforce_password = encrypt_secret(creds.password)
    tenant.salesforce_instance_url = info.get("instance_url")
    await db.commit()
    await db.refresh(tenant)
    return SalesforceIntegrationStatus(
        connected=True,
        instance_url=tenant.salesforce_instance_url,
    )


@router.post("/salesforce/test", response_model=TestSalesforceResponse)
@limiter.limit("5/minute")
async def test_salesforce(
    request: Request,
    user_id: str = Depends(require_permission("integrations", "manage")),
    db: AsyncSession = Depends(get_db),
):
    """Re-test the stored credentials."""
    tenant = await _get_tenant_for_user(user_id, db)
    creds = _decrypt_salesforce_creds(tenant)
    if creds is None:
        raise HTTPException(status_code=400, detail="Salesforce is not configured yet")
    try:
        info = await salesforce_service.test_connection(creds)
        return TestSalesforceResponse(ok=True, instance_url=info.get("instance_url"))
    except SalesforceError as e:
        return TestSalesforceResponse(ok=False, detail=str(e))
    except Exception as e:  # noqa: BLE001
        return TestSalesforceResponse(ok=False, detail=f"Network error: {e}")


@router.delete("/salesforce", status_code=204)
async def delete_salesforce_config(
    user_id: str = Depends(require_permission("integrations", "manage")),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant_for_user(user_id, db)
    tenant.salesforce_client_id = None
    tenant.salesforce_client_secret = None
    tenant.salesforce_username = None
    tenant.salesforce_password = None
    tenant.salesforce_instance_url = None
    await db.commit()
