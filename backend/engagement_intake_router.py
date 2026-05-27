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
  GMAIL_USER               — Gmail address used for SMTP auth + From header
  GMAIL_APP_PASSWORD       — Gmail App Password (injected from Key Vault)
  CONTACT_NOTIFY_EMAIL     — destination inbox (defaults to GMAIL_USER)
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

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT   = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE   = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_ACCOUNTS_CTR      = "accounts"
_ENGAGEMENTS_CTR   = "client_engagements"

_QUEUE_ENDPOINT = os.getenv("AZURE_STORAGE_QUEUE_ENDPOINT", "")
_QUEUE_NAME     = os.getenv("ENGAGEMENT_INTAKE_QUEUE_NAME", "engagement-intake")

_GMAIL_USER    = os.getenv("GMAIL_USER", "david.terian@gmail.com")
_GMAIL_APP_PWD = os.getenv("GMAIL_APP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", "sales@terian-services.com")
_FROM_NAME     = "Terian Services"
_SMTP_HOST     = "smtp.gmail.com"
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


def _send_emails_sync(body: EngagementRegisterRequest, account_id: str, engagement_id: str) -> None:
    """
    Send both outbound emails in a SINGLE SMTP session to avoid Gmail
    throttling two rapid back-to-back connections from the same App Password.

      Msg 1 → _NOTIFY_TO   : [New Engagement] internal notification for sales@
      Msg 2 → body.email   : Welcome / confirmation to the requester

    Called via asyncio.to_thread.
    """
    if not _GMAIL_APP_PWD:
        logger.warning("GMAIL_APP_PASSWORD not set — skipping all outbound emails")
        return

    from_header = f"{_FROM_NAME} <{_GMAIL_USER}>"

    # ── Message 1: internal notification ─────────────────────────────────────

    notify_subject = f"[New Engagement] {body.org_name} — {body.engagement_type}"
    notify_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Engagement Request</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">
              terian-services.com
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Contact</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">Name</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{body.full_name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{body.email}" style="color:#0d9488;text-decoration:none;">{body.email}</a>
                </td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{body.org_name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Industry</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{body.industry or "—"}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Est. Users</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{body.user_count:,}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Engagement</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0d9488;">{body.engagement_type}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Tier Interest</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{body.tier_interest}</td>
              </tr>
            </table>

            {"<p style='margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;'>Use Case</p><div style='background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #0d9488;border-radius:6px;padding:16px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;'>" + body.use_case + "</div>" if body.use_case else ""}

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              Account ID: {account_id}<br>
              Engagement ID: {engagement_id}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terian Services · terian-services.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    notify_msg = MIMEMultipart("alternative")
    notify_msg["Subject"] = notify_subject
    notify_msg["From"]    = from_header
    notify_msg["To"]      = _NOTIFY_TO
    notify_msg.attach(MIMEText(notify_html, "html"))

    # ── Message 2: requester welcome ──────────────────────────────────────────

    first_name = body.full_name.split()[0]
    welcome_subject = "Welcome to Terian Services — we've received your request"
    welcome_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">Welcome to Terian Services</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">
              terian-services.com
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.6;">
              Hi {first_name},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for reaching out — we're glad you're here. We've received your engagement
              request for <strong style="color:#111827;">{body.org_name}</strong> and our team
              will be in touch shortly to discuss next steps.
            </p>

            <!-- Summary card -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Your Request Summary</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:140px;">Engagement</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0d9488;">{body.engagement_type}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Tier</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{body.tier_interest}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{body.org_name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Est. Users</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{body.user_count:,}</td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              We're preparing a personalised overview of how Terian Services can address your
              needs. You'll receive it via a follow-up email shortly — keep an eye on your inbox.
            </p>

            <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
              In the meantime, feel free to reach us at
              <a href="mailto:sales@terian-services.com"
                 style="color:#0d9488;text-decoration:none;">sales@terian-services.com</a>
              with any questions.
            </p>

            <p style="margin:28px 0 0;font-size:15px;color:#374151;line-height:1.6;">
              Warm regards,<br>
              <strong style="color:#111827;">The Terian Services Team</strong>
            </p>

            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;">
              Reference: {engagement_id}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terian Services · terian-services.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    welcome_msg = MIMEMultipart("alternative")
    welcome_msg["Subject"] = welcome_subject
    welcome_msg["From"]    = from_header
    welcome_msg["To"]      = str(body.email)
    welcome_msg.attach(MIMEText(welcome_html, "html"))

    # ── Single SMTP session — send both messages ───────────────────────────────

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_GMAIL_USER, _GMAIL_APP_PWD)
        server.sendmail(_GMAIL_USER, [_NOTIFY_TO], notify_msg.as_string())
        server.sendmail(_GMAIL_USER, [str(body.email)], welcome_msg.as_string())

    logger.info(
        "Emails sent: engagement_id=%s notification→%s welcome→%s",
        engagement_id, _NOTIFY_TO, body.email,
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
        await asyncio.to_thread(_send_emails_sync, body, account_id, engagement_id)
    except Exception as exc:
        logger.warning("Email send failed (records saved): %s", exc)

    try:
        await _enqueue_engagement_job(body, account_id, engagement_id)
    except Exception as exc:
        logger.warning("Engagement queue enqueue failed (records saved): %s", exc)

    return EngagementRegisterResponse(ok=True, account_id=account_id, engagement_id=engagement_id)
