"""
contact_router.py
─────────────────
POST /api/contact

  1. Validates the inbound contact form (name, email, company, inquiry, message).
  2. Persists a document to Cosmos DB → terian-services / client_communications.
  3. Sends an HTML notification email to the configured inbox via Gmail SMTP.
  4. Returns {"ok": true, "id": "<uuid>"}.

Email is fire-and-forget: a transient SMTP failure logs a warning but does not
cause the endpoint to return an error — the message is already in Cosmos DB.

Environment variables
  AZURE_COSMOS_ENDPOINT   — Cosmos DB account endpoint (required)
  AZURE_COSMOS_DATABASE   — database name (default: terian-services)
  GMAIL_USER              — Gmail address used for SMTP auth + From header
  GMAIL_APP_PASSWORD      — Gmail App Password (injected from Key Vault)
  CONTACT_NOTIFY_EMAIL    — destination inbox (defaults to GMAIL_USER)
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_CONTAINER_NAME  = "client_communications"

_GMAIL_USER    = os.getenv("GMAIL_USER", "david.terian@gmail.com")
_GMAIL_APP_PWD = os.getenv("GMAIL_APP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", _GMAIL_USER)
_FROM_NAME     = "Terian Services"
_SMTP_HOST     = "smtp.gmail.com"
_SMTP_PORT     = 587


# ── Schema ────────────────────────────────────────────────────────────────────

class ContactRequest(BaseModel):
    name:    str      = Field(..., min_length=1, max_length=200)
    email:   EmailStr
    company: str      = Field("", max_length=200)
    inquiry: str      = Field(..., min_length=1, max_length=100)
    message: str      = Field(..., min_length=1, max_length=5000)


class ContactResponse(BaseModel):
    ok: bool
    id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


async def _save_to_cosmos(doc: dict) -> None:
    if not _COSMOS_ENDPOINT:
        logger.warning("AZURE_COSMOS_ENDPOINT not set — skipping Cosmos write")
        return
    async with _credential() as credential:
        async with CosmosClient(_COSMOS_ENDPOINT, credential=credential) as client:
            db = client.get_database_client(_COSMOS_DATABASE)
            container = db.get_container_client(_CONTAINER_NAME)
            await container.create_item(doc)


def _send_email_sync(contact: ContactRequest, doc_id: str) -> None:
    """Blocking SMTP send — called via asyncio.to_thread."""
    if not _GMAIL_APP_PWD:
        logger.warning("GMAIL_APP_PASSWORD not set — skipping email notification")
        return

    subject = f"[{contact.inquiry}] New contact from {contact.name}"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:560px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Contact Form Submission</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">
              terian-services.com
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <!-- Details table -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Contact Details</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;
                           width:110px;">Name</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;
                           color:#111827;">{contact.name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{contact.email}"
                     style="color:#0d9488;text-decoration:none;">
                    {contact.email}
                  </a>
                </td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Company</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;
                           color:#111827;">{contact.company or "—"}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Inquiry</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;
                           color:#111827;">{contact.inquiry}</td>
              </tr>
            </table>

            <!-- Message -->
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;">Message</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;
                        border-left:4px solid #0d9488;border-radius:6px;
                        padding:16px;font-size:14px;color:#374151;line-height:1.7;
                        white-space:pre-wrap;">{contact.message}</div>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              Submission ID: {doc_id}
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

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{_FROM_NAME} <{_GMAIL_USER}>"
    msg["To"]      = _NOTIFY_TO
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_GMAIL_USER, _GMAIL_APP_PWD)
        server.sendmail(_GMAIL_USER, [_NOTIFY_TO], msg.as_string())

    logger.info("Contact notification sent: id=%s from=%s", doc_id, contact.email)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/api/contact", response_model=ContactResponse)
async def contact(body: ContactRequest) -> ContactResponse:
    """
    Persist a contact form submission and fire a notification email.
    Returns 200 with {"ok": true, "id": "<uuid>"} on success.
    Returns 502 if the Cosmos DB write fails (email failure is non-fatal).
    """
    doc_id = str(uuid.uuid4())
    doc = {
        "id":           doc_id,
        "name":         body.name,
        "email":        body.email,
        "company":      body.company,
        "inquiry":      body.inquiry,
        "message":      body.message,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "source":       "contact-form",
    }

    try:
        await _save_to_cosmos(doc)
    except Exception as exc:
        logger.exception("Failed to persist contact form: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not save your message. Please try again or email us directly.",
        )

    # Email is best-effort — a transient SMTP failure must not block the response.
    try:
        await asyncio.to_thread(_send_email_sync, body, doc_id)
    except Exception as exc:
        logger.warning("Contact email notification failed (message saved): %s", exc)

    return ContactResponse(ok=True, id=doc_id)
