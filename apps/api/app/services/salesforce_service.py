"""
Salesforce native CRM integration.

Uses the OAuth 2.0 Username-Password Flow (a.k.a. resource-owner password) so that
tenants can paste credentials from a Connected App into the dashboard. The flow:

1. POST client_id + client_secret + username + (password+security_token) to
   https://login.salesforce.com/services/oauth2/token  → access_token + instance_url
2. Use the returned access_token as a Bearer to call REST API v60.0.

We do not persist the access_token; we mint one per call. (Login is cheap and avoids
having to track expiry / refresh for v1. We can add caching later.)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SALESFORCE_LOGIN_URL = "https://login.salesforce.com/services/oauth2/token"
API_VERSION = "v60.0"


@dataclass
class SalesforceCreds:
    client_id: str
    client_secret: str
    username: str
    password: str  # password + security token concatenated, per Salesforce convention


@dataclass
class SalesforceSession:
    access_token: str
    instance_url: str


class SalesforceError(Exception):
    """Raised when Salesforce returns a non-2xx response we cannot recover from."""


async def _login(creds: SalesforceCreds) -> SalesforceSession:
    """Exchange username/password creds for a short-lived access token."""
    data = {
        "grant_type": "password",
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "username": creds.username,
        "password": creds.password,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(SALESFORCE_LOGIN_URL, data=data)
    if resp.status_code >= 300:
        detail = resp.text[:400]
        logger.warning(f"[Salesforce] Login failed HTTP {resp.status_code}: {detail}")
        raise SalesforceError(f"Salesforce login failed (HTTP {resp.status_code}): {detail}")
    payload = resp.json()
    access_token = payload.get("access_token")
    instance_url = payload.get("instance_url")
    if not access_token or not instance_url:
        raise SalesforceError("Salesforce login response missing access_token/instance_url")
    return SalesforceSession(access_token=access_token, instance_url=instance_url)


async def test_connection(creds: SalesforceCreds) -> dict[str, Any]:
    """Log in and fetch org identity. Raises SalesforceError on failure."""
    session = await _login(creds)
    # Hit the identity endpoint via /services/data to confirm token works.
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{session.instance_url}/services/data/{API_VERSION}/",
            headers={"Authorization": f"Bearer {session.access_token}"},
        )
    if resp.status_code >= 300:
        raise SalesforceError(f"Salesforce API probe failed (HTTP {resp.status_code}): {resp.text[:200]}")
    return {"instance_url": session.instance_url}


async def upsert_lead(
    creds: SalesforceCreds,
    email: str,
    properties: dict[str, Any],
) -> str | None:
    """
    Upsert a Lead by Email (used as the external ID for idempotent capture).

    NOTE: For Email to work as an upsert key, it must be marked as an External ID
    on the Lead.Email field in Salesforce. If not configured, this falls back to
    a plain Lead create.

    Returns the Salesforce Lead id (15 or 18 chars) if known, else None.
    """
    try:
        session = await _login(creds)
    except SalesforceError as e:
        logger.warning(f"[Salesforce] upsert_lead login failed: {e}")
        return None

    # Salesforce requires LastName at minimum on Lead create.
    body = {
        "LastName": properties.get("last_name") or properties.get("name") or "Unknown",
        "Company": properties.get("company") or "Unknown",
        "Email": email,
    }
    if properties.get("first_name"):
        body["FirstName"] = properties["first_name"]
    if properties.get("phone"):
        body["Phone"] = properties["phone"]
    if properties.get("lead_source"):
        body["LeadSource"] = properties["lead_source"]
    if properties.get("description"):
        body["Description"] = properties["description"]

    upsert_url = (
        f"{session.instance_url}/services/data/{API_VERSION}/sobjects/Lead/Email/{email}"
        f"?_HttpMethod=PATCH"
    )
    headers = {
        "Authorization": f"Bearer {session.access_token}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(upsert_url, headers=headers, json=body)
        # 200/201/204 are all success for upsert.
        if resp.status_code in (200, 201):
            data = resp.json() if resp.content else {}
            return data.get("id")
        if resp.status_code == 204:
            return None
        # Fallback: Email may not be configured as External ID → create plain Lead.
        if resp.status_code in (400, 404):
            logger.info(
                f"[Salesforce] Email upsert returned {resp.status_code}, falling back to create. "
                f"Detail: {resp.text[:200]}"
            )
            create_url = f"{session.instance_url}/services/data/{API_VERSION}/sobjects/Lead"
            async with httpx.AsyncClient(timeout=10) as client:
                create_resp = await client.post(create_url, headers=headers, json=body)
            if create_resp.status_code in (200, 201):
                return create_resp.json().get("id")
            logger.warning(
                f"[Salesforce] Lead create failed HTTP {create_resp.status_code}: {create_resp.text[:200]}"
            )
            return None
        logger.warning(f"[Salesforce] upsert_lead HTTP {resp.status_code}: {resp.text[:200]}")
        return None
    except httpx.HTTPError as e:
        logger.warning(f"[Salesforce] upsert_lead network error: {e}")
        return None


async def attach_note(
    creds: SalesforceCreds,
    lead_id: str,
    subject: str,
    body: str,
) -> bool:
    """Create a completed Task associated with the Lead, carrying the transcript."""
    try:
        session = await _login(creds)
    except SalesforceError as e:
        logger.warning(f"[Salesforce] attach_note login failed: {e}")
        return False

    task_body = {
        "Subject": subject[:255],
        "Description": body[:32000],  # Salesforce Description hard cap
        "WhoId": lead_id,
        "Status": "Completed",
        "Priority": "Normal",
    }
    url = f"{session.instance_url}/services/data/{API_VERSION}/sobjects/Task"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {session.access_token}",
                    "Content-Type": "application/json",
                },
                json=task_body,
            )
        if resp.status_code in (200, 201):
            return True
        logger.warning(f"[Salesforce] attach_note HTTP {resp.status_code}: {resp.text[:200]}")
        return False
    except httpx.HTTPError as e:
        logger.warning(f"[Salesforce] attach_note network error: {e}")
        return False
