"""
agents/skills/contact/tools.py
────────────────────────────────
Tool for sending a notification email to a Terian Services inbox on behalf
of a website visitor.

Reuses the same Zoho SMTP + Cosmos DB pattern as contact_router.py:
  - SMTP send runs in a thread (blocking smtplib, non-blocking for FastAPI)
  - Message is persisted to the client_communications Cosmos container
  - Email is best-effort: a transient SMTP failure returns an error result
    so the LLM can direct the visitor to the contact form instead

Security
────────
  The `recipient` parameter is an enum — the tool maps it to a hardcoded
  email address.  The LLM can never be prompted into sending to an arbitrary
  address, and the whitelist is enforced in Python, not in the prompt.

Environment variables
─────────────────────
  SMTP_USER               — SMTP sender address (sales@terian-services.com)
  SMTP_PASSWORD           — Zoho App Password (injected from Key Vault)
  SMTP_HOST               — SMTP server (default: smtppro.zoho.com)
  AZURE_COSMOS_ENDPOINT   — Cosmos DB account endpoint URL
  AZURE_COSMOS_DATABASE   — database name (default: terian-services)
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
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT     = 587
_FROM_NAME     = "Terian Services — Ask AI"

_COSMOS_CONTAINER = "client_communications"

# Hardcoded whitelist — the LLM passes a label, never a raw email address.
_RECIPIENT_MAP: dict[str, str] = {
    "sales":    "sales@terian-services.com",
    "support":  "support@terian-services.com",
    "security": "security@terian-services.com",
}

_CONTACT_FORM_URL = "https://www.terian-services.com/contact"


# ── Cosmos DB persistence ─────────────────────────────────────────────────────

async def _persist(doc: dict) -> None:
    endpoint = os.getenv("AZURE_COSMOS_ENDPOINT", "")
    database = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
    if not endpoint:
        logger.warning("contact tool: AZURE_COSMOS_ENDPOINT not set — skipping persist")
        return
    try:
        async with DefaultAzureCredential() as cred:
            async with CosmosClient(endpoint, credential=cred) as client:
                container = (
                    client
                    .get_database_client(database)
                    .get_container_client(_COSMOS_CONTAINER)
                )
                await container.create_item(doc)
        logger.info("contact tool: persisted message %s", doc["id"])
    except Exception as exc:
        logger.warning("contact tool: Cosmos persist failed: %s", exc)


# ── SMTP send (blocking — run in thread) ──────────────────────────────────────

def _send_email_sync(
    to_address: str,
    from_name: str,
    from_email: str,
    message: str,
    doc_id: str,
) -> None:
    """Send an HTML notification email via Gmail SMTP."""
    subject = f"[Ask AI] Message from {from_name}"
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
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#4338ca 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Message via Ask AI</h1>
            <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;">
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
                           letter-spacing:0.5px;">Contact Details</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;
                           width:110px;">Name</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;
                           color:#111827;">{from_name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{from_email}"
                     style="color:#4f46e5;text-decoration:none;">{from_email}</a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;">Message</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;
                        border-left:4px solid #4f46e5;border-radius:6px;
                        padding:16px;font-size:14px;color:#374151;line-height:1.7;
                        white-space:pre-wrap;">{message}</div>

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
    msg["From"]    = f"{_FROM_NAME} <{_SMTP_USER}>"
    msg["To"]      = to_address
    msg["Reply-To"] = from_email
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_USER, [to_address], msg.as_string())

    logger.info(
        "contact tool: email sent to %s from %s (id=%s)",
        to_address, from_email, doc_id,
    )


# ── Tool implementation ───────────────────────────────────────────────────────

async def send_notification(
    recipient: str,
    from_name: str,
    from_email: str,
    message: str,
) -> dict:
    """
    Send a notification email to a Terian Services inbox on behalf of a visitor.

    recipient  — "sales" | "support" | "security"
    from_name  — visitor's full name
    from_email — visitor's email address
    message    — the message body to send

    Returns:
      status    — "ok" or "error"
      error     — present only on failure; includes the contact form URL
    """
    # Resolve recipient to a whitelisted address
    to_address = _RECIPIENT_MAP.get(recipient.lower().strip())
    if not to_address:
        logger.error("contact tool: unknown recipient %r", recipient)
        return {
            "status": "error",
            "error": (
                f"Unknown recipient '{recipient}'. "
                f"Valid options: {', '.join(_RECIPIENT_MAP)}."
            ),
        }

    if not _SMTP_PASSWORD:
        logger.error("contact tool: GMAIL_APP_PASSWORD not set")
        return {
            "status": "error",
            "error": f"Email service is not configured. Please use {_CONTACT_FORM_URL}",
        }

    doc_id = str(uuid.uuid4())

    # Persist to Cosmos DB (best-effort — don't block on failure)
    doc = {
        "id":           doc_id,
        "name":         from_name,
        "email":        from_email,
        "company":      "",
        "inquiry":      recipient,
        "message":      message,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "source":       "ask-ai",
    }
    await _persist(doc)

    # Send email (blocking SMTP in a thread)
    try:
        await asyncio.to_thread(
            _send_email_sync,
            to_address, from_name, from_email, message, doc_id,
        )
    except Exception as exc:
        logger.error("contact tool: SMTP failed: %s", exc, exc_info=True)
        return {
            "status": "error",
            "error": (
                f"The message could not be sent due to a technical issue. "
                f"Please use the contact form instead: {_CONTACT_FORM_URL}"
            ),
        }

    return {"status": "ok", "to": to_address, "id": doc_id}


# ── OpenAI tool schema ────────────────────────────────────────────────────────

SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "send_notification",
            "description": (
                "Send a notification email to a Terian Services inbox on behalf "
                "of a website visitor. Only call this tool after the visitor has "
                "explicitly confirmed the message. Never call it more than once "
                "for the same request."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "recipient": {
                        "type": "string",
                        "enum": ["sales", "support", "security"],
                        "description": (
                            "Which Terian Services inbox to notify. "
                            "Use 'sales' for quotes, demos, and partnerships; "
                            "'support' for technical issues; "
                            "'security' for vulnerability reports."
                        ),
                    },
                    "from_name": {
                        "type": "string",
                        "description": "The visitor's full name.",
                    },
                    "from_email": {
                        "type": "string",
                        "description": "The visitor's email address.",
                    },
                    "message": {
                        "type": "string",
                        "description": (
                            "The full message to send, written in plain English. "
                            "Include all relevant context from the conversation."
                        ),
                    },
                },
                "required": ["recipient", "from_name", "from_email", "message"],
            },
        },
    },
]

# ── Dispatch table ────────────────────────────────────────────────────────────

IMPLEMENTATIONS: dict = {
    "send_notification": send_notification,
}
