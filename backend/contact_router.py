"""
contact_router.py
─────────────────
POST /api/contact

  1. Validates the inbound contact form (name, email, company, inquiry, message).
  2. Persists a document to Cosmos DB → terian-services / client_communications.
  3. Uploads any file attachments to Azure Blob Storage (client-com-attachments
     container) at path {doc_id}/{filename}; records blob_path per file in the
     Cosmos document. Blob upload is best-effort — a failure logs a warning but
     does not block the response (the submission is already in Cosmos DB).
  4. Sends an HTML notification email to the configured inbox via Zoho SMTP with
     the files attached. Email is also best-effort (same non-fatal contract).
  5. Returns {"ok": true, "id": "<uuid>"}.

Environment variables
  AZURE_COSMOS_ENDPOINT        — Cosmos DB account endpoint (required)
  AZURE_COSMOS_DATABASE        — database name (default: terian-services)
  AZURE_STORAGE_BLOB_ENDPOINT  — Blob Storage account URL (required for uploads)
  AZURE_CLIENT_ID              — UAMI client ID (optional; triggers ManagedIdentity)
  SMTP_USER                    — SMTP sender address (sales@terian-services.com)
  SMTP_PASSWORD                — Zoho App Password (injected from Key Vault)
  SMTP_HOST                    — SMTP server (default: smtppro.zoho.com)
  CONTACT_NOTIFY_EMAIL         — destination inbox (defaults to SMTP_USER)
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from azure.storage.blob.aio import BlobServiceClient
from azure.storage.blob import ContentSettings
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_CONTAINER_NAME  = "client_communications"

_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", _SMTP_USER)
_FROM_NAME     = "Terian Services"
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT     = 587

_BLOB_ENDPOINT  = os.getenv("AZURE_STORAGE_BLOB_ENDPOINT", "").rstrip("/")
_BLOB_CONTAINER = "client-com-attachments"


# ── Config ────────────────────────────────────────────────────────────────────

_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024   # 10 MB per file
_MAX_ATTACHMENTS      = 3


# ── Schema ────────────────────────────────────────────────────────────────────

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
        logger.warning("contact_router: AZURE_COSMOS_ENDPOINT not set — skipping Cosmos write")
        return

    logger.info(
        "contact_router: writing to Cosmos — endpoint=%s database=%s container=%s id=%s",
        _COSMOS_ENDPOINT, _COSMOS_DATABASE, _CONTAINER_NAME, doc.get("id"),
    )
    async with _credential() as credential:
        async with CosmosClient(_COSMOS_ENDPOINT, credential=credential) as client:
            db = client.get_database_client(_COSMOS_DATABASE)
            container = db.get_container_client(_CONTAINER_NAME)
            result = await container.create_item(doc)
            logger.info(
                "contact_router: Cosmos write succeeded — id=%s etag=%s",
                result.get("id"), result.get("_etag"),
            )


async def _upload_attachments_to_blob(
    doc_id: str,
    attachments: list[tuple[str, str, bytes]],  # (filename, content_type, data)
) -> list[str | None]:
    """
    Upload each attachment to the client-com-attachments blob container.

    Blobs are stored at: {doc_id}/{filename}

    Returns a list of blob paths (one per attachment, None on per-file failure).
    Failures are logged as warnings and never re-raised — the contact submission
    is already in Cosmos DB regardless of blob upload outcome.
    """
    if not _BLOB_ENDPOINT:
        logger.warning("AZURE_STORAGE_BLOB_ENDPOINT not set — skipping blob upload")
        return [None] * len(attachments)

    paths: list[str | None] = []
    try:
        async with _credential() as credential:
            async with BlobServiceClient(account_url=_BLOB_ENDPOINT, credential=credential) as service:
                for filename, content_type, data in attachments:
                    blob_path = f"{doc_id}/{filename}"
                    try:
                        blob_client = service.get_blob_client(
                            container=_BLOB_CONTAINER, blob=blob_path
                        )
                        await blob_client.upload_blob(
                            data,
                            overwrite=True,
                            content_settings=ContentSettings(content_type=content_type),
                        )
                        logger.info(
                            "contact_router: uploaded %d bytes → %s/%s",
                            len(data), _BLOB_CONTAINER, blob_path,
                        )
                        paths.append(blob_path)
                    except Exception as exc:
                        logger.warning(
                            "contact_router: failed to upload %s for doc %s: %s",
                            filename, doc_id, exc,
                        )
                        paths.append(None)
    except Exception as exc:
        logger.warning(
            "contact_router: could not open BlobServiceClient for doc %s: %s",
            doc_id, exc,
        )
        paths = [None] * len(attachments)

    return paths


def _send_email_sync(
    name: str,
    email: str,
    company: str,
    inquiry: str,
    message: str,
    doc_id: str,
    attachments: list[tuple[str, str, bytes]],  # (filename, content_type, data)
) -> None:
    """Blocking SMTP send — called via asyncio.to_thread."""
    if not _SMTP_PASSWORD:
        logger.warning("SMTP_PASSWORD not set — skipping email notification")
        return

    subject = f"[{inquiry}] New contact from {name}"
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
                           color:#111827;">{name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{email}"
                     style="color:#0d9488;text-decoration:none;">
                    {email}
                  </a>
                </td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Company</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;
                           color:#111827;">{company or "—"}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">
                  Inquiry</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;
                           color:#111827;">{inquiry}</td>
              </tr>
            </table>

            <!-- Message -->
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;">Message</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;
                        border-left:4px solid #0d9488;border-radius:6px;
                        padding:16px;font-size:14px;color:#374151;line-height:1.7;
                        white-space:pre-wrap;">{message}</div>
            {f'''<p style="margin:16px 0 0;font-size:11px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;">Attachments</p>
            <p style="margin:6px 0 0;font-size:13px;color:#374151;">
              {", ".join(fname for fname, _, _ in attachments)}
            </p>''' if attachments else ""}

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

    # Outer envelope: mixed (body + attachments)
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = f"{_FROM_NAME} <{_SMTP_USER}>"
    msg["To"]      = _NOTIFY_TO

    # HTML body wrapped in an alternative part
    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(html, "html"))
    msg.attach(body_part)

    # File attachments
    for filename, content_type, data in attachments:
        maintype, _, subtype = content_type.partition("/")
        part = MIMEBase(maintype or "application", subtype or "octet-stream")
        part.set_payload(data)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_USER, [_NOTIFY_TO], msg.as_string())

    logger.info("Contact notification sent: id=%s from=%s attach=%d",
                doc_id, email, len(attachments))


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/api/contact", response_model=ContactResponse)
async def contact(
    name:    str = Form(..., min_length=1, max_length=200),
    email:   str = Form(...),
    company: str = Form("", max_length=200),
    inquiry: str = Form(..., min_length=1, max_length=100),
    message: str = Form(..., min_length=1, max_length=5000),
    files:   List[UploadFile] = File(default=[]),
) -> ContactResponse:
    """
    Persist a contact form submission and fire a notification email with any
    attached files. Accepts multipart/form-data.

    Returns 200 {"ok": true, "id": "<uuid>"} on success.
    Returns 400 for attachment validation errors.
    Returns 502 if the Cosmos DB write fails (email failure is non-fatal).
    """
    # ── Validate attachments ──────────────────────────────────────────────────
    if len(files) > _MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {_MAX_ATTACHMENTS} attachments allowed.",
        )

    attachment_data: list[tuple[str, str, bytes]] = []
    for upload in files:
        # UploadFile with no actual file has an empty filename
        if not upload.filename:
            continue
        data = await upload.read()
        if len(data) > _MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File '{upload.filename}' exceeds the 10 MB limit.",
            )
        content_type = upload.content_type or "application/octet-stream"
        attachment_data.append((upload.filename, content_type, data))

    # ── Persist to Cosmos DB ──────────────────────────────────────────────────
    doc_id = str(uuid.uuid4())
    doc = {
        "id":           doc_id,
        "name":         name,
        "email":        email,
        "company":      company,
        "inquiry":      inquiry,
        "message":      message,
        "attachments":  [{"name": fn, "type": ct, "size": len(d)}
                         for fn, ct, d in attachment_data],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "source":       "contact-form",
    }

    try:
        await _save_to_cosmos(doc)
    except Exception as exc:
        logger.exception(
            "contact_router: Cosmos write FAILED for id=%s — %s: %s",
            doc_id, type(exc).__name__, exc,
        )
        raise HTTPException(
            status_code=502,
            detail="Could not save your message. Please try again or email us directly.",
        )

    # ── Upload attachments to Blob Storage (best-effort) ──────────────────────
    # Blob paths are recorded back into the Cosmos document so they can be
    # retrieved later without scanning blob storage.
    if attachment_data:
        blob_paths = await _upload_attachments_to_blob(doc_id, attachment_data)

        # Patch blob_path onto each attachment entry and replace the document.
        patched_attachments = []
        for (fn, ct, d), bp in zip(attachment_data, blob_paths):
            entry = {"name": fn, "type": ct, "size": len(d)}
            if bp:
                entry["blob_path"] = bp
            patched_attachments.append(entry)

        if any(bp is not None for bp in blob_paths):
            # At least one blob succeeded — update the Cosmos document.
            doc["attachments"] = patched_attachments
            try:
                async with _credential() as credential:
                    async with CosmosClient(_COSMOS_ENDPOINT, credential=credential) as client:
                        db = client.get_database_client(_COSMOS_DATABASE)
                        container = db.get_container_client(_CONTAINER_NAME)
                        await container.replace_item(item=doc_id, body=doc)
            except Exception as exc:
                logger.warning(
                    "contact_router: could not patch blob_paths into Cosmos doc %s: %s",
                    doc_id, exc,
                )

    # ── Email is best-effort — a transient SMTP failure must not block the response.
    try:
        await asyncio.to_thread(
            _send_email_sync,
            name, email, company, inquiry, message,
            doc_id, attachment_data,
        )
    except Exception as exc:
        logger.warning("Contact email notification failed (message saved): %s", exc)

    return ContactResponse(ok=True, id=doc_id)
