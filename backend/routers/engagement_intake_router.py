"""
engagement_intake_router.py
───────────────────────────
POST /api/accounts/register

Three-step new-engagement intake flow:

  1. Create (or retrieve) an account in CosmosDB → accounts container.
  2. Create an engagement request in CosmosDB → client_engagements container,
     with request_status = "pending_review".
  3. Fire an HTML email notification to the configured inbox.

Returns {"ok": true, "account_id": "...", "engagement_id": "..."}.

Password handling
  Passwords are hashed with bcrypt before storage. The raw password is never
  persisted. (Full auth / login endpoints come in a later iteration when the
  admin role is defined.)

Email is fire-and-forget: a transient SMTP failure logs a warning but does not
cause the endpoint to return an error — both records are already in CosmosDB.

Environment variables
  AZURE_COSMOS_ENDPOINT    — Cosmos DB account endpoint (required)
  AZURE_COSMOS_DATABASE    — database name (default: terian-services)
  SMTP_USER                — SMTP sender address (sales@terian-services.com)
  SMTP_PASSWORD            — Zoho App Password (injected from Key Vault)
  SMTP_HOST                — SMTP server (default: smtppro.zoho.com)
  CONTACT_NOTIFY_EMAIL     — destination inbox (defaults to SMTP_USER)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Literal

import bcrypt
from azure.cosmos.aio import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from azure.storage.queue.aio import QueueClient
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from services.email_template_service import get_template, render
from services.engagement_service import get_engagement_by_service

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT   = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE   = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_ACCOUNTS_CTR      = "accounts"
_ENGAGEMENTS_CTR   = "client_engagements"

_QUEUE_ENDPOINT = os.getenv("AZURE_STORAGE_QUEUE_ENDPOINT", "")
_QUEUE_NAME     = os.getenv("ENGAGEMENT_INTAKE_QUEUE_NAME", "engagement-intake")

_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", "sales@terian-services.com")
_DEFAULT_FROM_NAME = "Terian Services"
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT     = 587

RequestStatus = Literal[
    "pending_review", "contacted", "proposal_sent", "active", "declined"
]


# ── Schema ────────────────────────────────────────────────────────────────────

class EngagementRegisterRequest(BaseModel):
    # Step 1 — account
    full_name:    str      = Field(..., min_length=1, max_length=200)
    email:        EmailStr
    password:     str      = Field(..., min_length=8, max_length=128)

    # Step 2 — org & usage
    org_name:     str      = Field(..., min_length=1, max_length=200)
    industry:     str      = Field("", max_length=100)
    user_count:   int      = Field(..., ge=1, le=1_000_000)
    use_case:     str      = Field("", max_length=1000)
    tier_interest: str     = Field(..., min_length=1, max_length=100)

    # Engagement type from step 0 (pricing page selection)
    engagement_type: str   = Field(..., min_length=1, max_length=100)


class EngagementRegisterResponse(BaseModel):
    ok:            bool
    account_id:    str
    engagement_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


async def _get_or_create_account(
    db_client,
    email: str,
    full_name: str,
    password_hash: str,
) -> tuple[str, bool]:
    """
    Return (account_id, created).
    If an account with this email already exists, return its id without
    overwriting it (idempotent — allows re-submission after a failed step 2).
    """
    container = db_client.get_container_client(_ACCOUNTS_CTR)

    # Cross-partition query by email (partition key IS email, so this is
    # actually a single-partition read — Cosmos routes it correctly).
    query = "SELECT c.id FROM c WHERE c.email = @email"
    params = [{"name": "@email", "value": email}]
    items = [
        item
        async for item in container.query_items(
            query=query, parameters=params
        )
    ]
    if items:
        return items[0]["id"], False

    account_id = str(uuid.uuid4())
    await container.create_item({
        "id":             account_id,
        "email":          email,
        "full_name":      full_name,
        "password_hash":  password_hash,
        "email_verified": False,
        "created_at":     datetime.now(timezone.utc).isoformat(),
    })
    return account_id, True


async def _create_engagement(db_client, account_id: str, body: EngagementRegisterRequest) -> str:
    container = db_client.get_container_client(_ENGAGEMENTS_CTR)
    engagement_id = str(uuid.uuid4())
    await container.create_item({
        "id":              engagement_id,
        "account_id":      account_id,
        "engagement_type": body.engagement_type,
        "org_name":        body.org_name,
        "industry":        body.industry,
        "user_count":      body.user_count,
        "use_case":        body.use_case,
        "tier_interest":   body.tier_interest,
        "request_status":  "pending_review",
        "submitted_at":    datetime.now(timezone.utc).isoformat(),
    })
    return engagement_id


def _send_emails_sync(messages: list[tuple[str, str, str]], from_name: str) -> None:
    """
    Send one or more pre-rendered HTML emails in a SINGLE SMTP session to
    avoid throttling back-to-back connections from the same App Password.

    Args:
        messages: list of (subject, html_body, to_addr) tuples, already
            rendered from CosmosDB email_templates documents.
        from_name: display name for the From: header — this is the
            per-service `notifications.sending_corporation` value
            ("Terianix.ai" or "Terian Services"). Both services share the
            same Zoho mailbox/credentials; only the display name differs.

    Called via asyncio.to_thread.
    """
    if not _SMTP_PASSWORD:
        logger.warning("SMTP_PASSWORD not set — skipping all outbound emails")
        return

    if not messages:
        return

    from_header = f"{from_name} <{_SMTP_USER}>"

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        for subject, html_body, to_addr in messages:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = from_header
            msg["To"]      = to_addr
            msg.attach(MIMEText(html_body, "html"))
            server.sendmail(_SMTP_USER, [to_addr], msg.as_string())

    logger.info("Emails sent: %d message(s) from '%s'", len(messages), from_name)


async def _send_intake_emails(body: EngagementRegisterRequest, account_id: str, engagement_id: str) -> None:
    """
    Resolve the per-service notifications config + email templates from
    CosmosDB, render Email #1 (internal heads-up) and Email #2 (requester
    welcome), and send them in a single SMTP session.

    Skip + log (non-fatal) if:
      - no engagement_details document matches body.engagement_type
      - that document has no `notifications` block
      - a referenced email_templates document is missing
    """
    engagement_doc = await get_engagement_by_service(body.engagement_type)
    if not engagement_doc or "notifications" not in engagement_doc:
        logger.warning(
            "No notifications config for engagement_type '%s' — skipping intake emails",
            body.engagement_type,
        )
        return

    notifications = engagement_doc["notifications"]
    sending_corporation = notifications.get("sending_corporation", _DEFAULT_FROM_NAME)

    tokens = {
        "first_name":      body.full_name.split()[0] if body.full_name.strip() else "",
        "full_name":       body.full_name,
        "org_name":        body.org_name,
        "email":           str(body.email),
        "industry":        body.industry or "—",
        "user_count":      f"{body.user_count:,}",
        "use_case":        body.use_case,
        "tier_interest":   body.tier_interest,
        "engagement_type": body.engagement_type,
        "account_id":      account_id,
        "engagement_id":   engagement_id,
    }

    messages: list[tuple[str, str, str]] = []

    heads_up_type = notifications.get("corporate_heads_up_email")
    if heads_up_type:
        template = await get_template(heads_up_type)
        if template:
            subject, html_body = render(template, tokens)
            messages.append((subject, html_body, _NOTIFY_TO))

    welcome_type = notifications.get("user_welcome_email")
    if welcome_type:
        template = await get_template(welcome_type)
        if template:
            subject, html_body = render(template, tokens)
            messages.append((subject, html_body, str(body.email)))

    if not messages:
        logger.warning(
            "No email templates resolved for engagement_type '%s' — skipping intake emails",
            body.engagement_type,
        )
        return

    await asyncio.to_thread(_send_emails_sync, messages, sending_corporation)

    logger.info(
        "Intake emails dispatched: engagement_id=%s engagement_type=%s sender=%s",
        engagement_id, body.engagement_type, sending_corporation,
    )


# ── Queue producer ────────────────────────────────────────────────────────────

async def _enqueue_engagement_job(
    body: EngagementRegisterRequest,
    account_id: str,
    engagement_id: str,
) -> None:
    """
    Drop a JSON message on the Storage Queue so the async worker can generate
    the personalised PPTX and send Email #2.

    The message is a compact JSON object — the worker needs no other context.
    Fire-and-forget: caller wraps in try/except so a queue failure never rolls
    back the already-persisted CosmosDB records.

    No-op if AZURE_STORAGE_QUEUE_ENDPOINT is unset (local / test environments).
    """
    if not _QUEUE_ENDPOINT:
        logger.warning("AZURE_STORAGE_QUEUE_ENDPOINT not set — skipping queue enqueue")
        return

    message = json.dumps({
        "engagement_id":   engagement_id,
        "account_id":      account_id,
        "email":           str(body.email),
        "full_name":       body.full_name,
        "org_name":        body.org_name,
        "industry":        body.industry,
        "user_count":      body.user_count,
        "use_case":        body.use_case,
        "tier_interest":   body.tier_interest,
        "engagement_type": body.engagement_type,
        "submitted_at":    datetime.now(timezone.utc).isoformat(),
    })

    async with _credential() as credential:
        async with QueueClient(
            account_url=_QUEUE_ENDPOINT,
            queue_name=_QUEUE_NAME,
            credential=credential,
        ) as queue:
            await queue.send_message(message)

    logger.info(
        "Engagement job enqueued: engagement_id=%s queue=%s",
        engagement_id, _QUEUE_NAME,
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/api/accounts/register", response_model=EngagementRegisterResponse)
async def register_engagement(body: EngagementRegisterRequest) -> EngagementRegisterResponse:
    """
    Complete the new-engagement intake in one call:
      1. Hash the password and upsert an account (idempotent on email).
      2. Create a client_engagement record with status=pending_review.
      3. Fire an HTML notification email (non-fatal if SMTP fails).
    """
    if not _COSMOS_ENDPOINT:
        logger.warning("AZURE_COSMOS_ENDPOINT not set — running in no-op mode")
        fake_id = str(uuid.uuid4())
        return EngagementRegisterResponse(ok=True, account_id=fake_id, engagement_id=fake_id)

    password_hash = await asyncio.to_thread(_hash_password, body.password)

    try:
        async with _credential() as credential:
            async with CosmosClient(_COSMOS_ENDPOINT, credential=credential) as cosmos:
                db = cosmos.get_database_client(_COSMOS_DATABASE)
                account_id, _ = await _get_or_create_account(
                    db, str(body.email), body.full_name, password_hash
                )
                engagement_id = await _create_engagement(db, account_id, body)
    except Exception as exc:
        logger.exception("Failed to persist engagement: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not save your request. Please try again.",
        )

    try:
        await _send_intake_emails(body, account_id, engagement_id)
    except Exception as exc:
        logger.warning("Email send failed (records saved): %s", exc)

    try:
        await _enqueue_engagement_job(body, account_id, engagement_id)
    except Exception as exc:
        logger.warning("Engagement queue enqueue failed (records saved): %s", exc)

    return EngagementRegisterResponse(ok=True, account_id=account_id, engagement_id=engagement_id)
