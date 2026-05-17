"""
HubSpot CRM integration helpers.

Uses HubSpot Private App access tokens (Bearer auth). Each function below is a thin
wrapper around the v3 CRM API and is safe to call from a fire-and-forget task —
all exceptions other than HubSpotAuthError are caught and logged by callers.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

HUBSPOT_API_BASE = "https://api.hubapi.com"
DEFAULT_TIMEOUT = 8.0


class HubSpotError(RuntimeError):
    """Generic HubSpot API failure."""


class HubSpotAuthError(HubSpotError):
    """Raised on 401 from HubSpot — token is invalid/revoked."""


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def test_connection(token: str) -> dict[str, Any]:
    """
    Validate a Private App token by hitting the account-info endpoint.

    Returns ``{"portal_id": int, "account_name": str | None, "currency": str | None,
    "time_zone": str | None}``.

    Raises :class:`HubSpotAuthError` on 401, :class:`HubSpotError` on other failures.
    """
    url = f"{HUBSPOT_API_BASE}/account-info/v3/details"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(url, headers=_headers(token))
    except httpx.HTTPError as exc:
        raise HubSpotError(f"Network error contacting HubSpot: {exc}") from exc

    if resp.status_code == 401:
        raise HubSpotAuthError("HubSpot rejected the access token (401).")
    if resp.status_code >= 400:
        raise HubSpotError(
            f"HubSpot returned HTTP {resp.status_code}: {resp.text[:200]}"
        )

    data = resp.json()
    return {
        "portal_id": data.get("portalId"),
        "account_name": data.get("companyName") or data.get("uiDomain"),
        "currency": data.get("companyCurrency"),
        "time_zone": data.get("timeZone"),
    }


async def upsert_contact(
    token: str,
    email: str,
    properties: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Create-or-update a HubSpot Contact, keyed by email.

    Tries POST /crm/v3/objects/contacts first; if HubSpot reports the contact
    already exists (HTTP 409 with the existing ID in the error body), falls back
    to a PATCH on that ID.

    Returns ``{"id": str, "created": bool}``.
    """
    if not email:
        raise HubSpotError("upsert_contact requires an email address")

    props = {"email": email, **(properties or {})}
    # Drop None values — HubSpot rejects nulls on string properties.
    props = {k: v for k, v in props.items() if v is not None and v != ""}

    create_url = f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts"
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(
            create_url, headers=_headers(token), json={"properties": props}
        )

        if resp.status_code == 201:
            body = resp.json()
            return {"id": body["id"], "created": True}

        if resp.status_code == 401:
            raise HubSpotAuthError("HubSpot rejected the access token (401).")

        if resp.status_code == 409:
            # Existing contact — extract ID from error body and PATCH it.
            try:
                err = resp.json()
                # HubSpot returns: "Contact already exists. Existing ID: 12345"
                message = err.get("message", "")
                existing_id = None
                if "Existing ID:" in message:
                    existing_id = message.split("Existing ID:")[-1].strip().rstrip(".")
                if not existing_id:
                    raise HubSpotError(f"409 from HubSpot but no existing ID: {message}")
            except (ValueError, KeyError) as exc:
                raise HubSpotError(f"Could not parse 409 response: {exc}") from exc

            update_url = f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts/{existing_id}"
            # Don't try to PATCH email (it's the unique key) — strip it.
            patch_props = {k: v for k, v in props.items() if k != "email"}
            if not patch_props:
                return {"id": existing_id, "created": False}
            patch_resp = await client.patch(
                update_url,
                headers=_headers(token),
                json={"properties": patch_props},
            )
            if patch_resp.status_code == 401:
                raise HubSpotAuthError("HubSpot rejected the access token (401).")
            if patch_resp.status_code >= 400:
                raise HubSpotError(
                    f"HubSpot PATCH failed HTTP {patch_resp.status_code}: "
                    f"{patch_resp.text[:200]}"
                )
            return {"id": existing_id, "created": False}

        raise HubSpotError(
            f"HubSpot create-contact failed HTTP {resp.status_code}: {resp.text[:200]}"
        )


async def attach_note(token: str, contact_id: str, body: str) -> dict[str, Any]:
    """
    Create a Note engagement and associate it with the given contact.

    Returns ``{"id": str}`` for the created note.
    """
    if not contact_id:
        raise HubSpotError("attach_note requires a contact_id")
    if not body:
        raise HubSpotError("attach_note requires a non-empty body")

    timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    payload = {
        "properties": {
            "hs_timestamp": timestamp_ms,
            # HubSpot truncates note bodies at 65,536 chars; cap a little lower for safety.
            "hs_note_body": body[:60000],
        },
        # Type 202 = note → contact association (built-in HubSpot type ID).
        "associations": [
            {
                "to": {"id": contact_id},
                "types": [
                    {
                        "associationCategory": "HUBSPOT_DEFINED",
                        "associationTypeId": 202,
                    }
                ],
            }
        ],
    }

    url = f"{HUBSPOT_API_BASE}/crm/v3/objects/notes"
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(token), json=payload)

    if resp.status_code == 401:
        raise HubSpotAuthError("HubSpot rejected the access token (401).")
    if resp.status_code >= 400:
        raise HubSpotError(
            f"HubSpot create-note failed HTTP {resp.status_code}: {resp.text[:200]}"
        )
    return {"id": resp.json()["id"]}


# ── High-level helpers used by chat / conversation flows ──────────────────────

async def sync_lead(
    *,
    token: str,
    email: str,
    name: str | None = None,
    phone: str | None = None,
    business_name: str | None = None,
) -> str | None:
    """
    Best-effort: upsert a contact and return their HubSpot ID.

    Swallows all errors except :class:`HubSpotAuthError` (re-raised so the caller
    can clear the connection). Returns ``None`` on any non-auth failure.
    """
    properties: dict[str, Any] = {}
    if name:
        # HubSpot splits on first whitespace into firstname/lastname.
        parts = name.strip().split(maxsplit=1)
        properties["firstname"] = parts[0]
        if len(parts) > 1:
            properties["lastname"] = parts[1]
    if phone:
        properties["phone"] = phone
    if business_name:
        properties["company"] = business_name

    try:
        result = await upsert_contact(token, email=email, properties=properties)
        return result["id"]
    except HubSpotAuthError:
        raise
    except Exception as exc:  # noqa: BLE001 — never block the chat flow
        logger.warning(f"[HubSpot] sync_lead failed for {email}: {exc}")
        return None


async def attach_transcript_by_email(
    *,
    token: str,
    email: str,
    transcript_body: str,
) -> bool:
    """
    Look up (or create) the contact by email, then attach a transcript note.

    Returns True on success. Swallows non-auth errors and logs them.
    """
    try:
        contact = await upsert_contact(token, email=email)
        await attach_note(token, contact_id=contact["id"], body=transcript_body)
        return True
    except HubSpotAuthError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[HubSpot] attach_transcript failed for {email}: {exc}")
        return False
