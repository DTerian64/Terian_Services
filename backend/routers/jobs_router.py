"""
jobs_router.py
──────────────
Public jobs board endpoints for terian-services.com.

GET  /api/jobs          — list all open job listings (summary fields only)
GET  /api/jobs/{id}     — full job document including sections[]
POST /api/jobs/{id}/apply — submit a job application (multipart/form-data)
  Fields: name, email, linkedin_url (optional), message
  File:   resume (PDF / Word, max 10 MB)

On successful application:
  • Document written to CosmosDB → terian-services / job_applications
  • Resume uploaded to blob storage → job-applications/{job_id}/{app_id}/{filename}
  • HTML notification email with resume attached sent to JOBS_NOTIFY_EMAIL

Environment variables
  AZURE_COSMOS_ENDPOINT        — Cosmos DB endpoint (required)
  AZURE_COSMOS_DATABASE        — database name (default: terian-services)
  AZURE_STORAGE_BLOB_ENDPOINT  — Blob Storage endpoint (required for uploads)
  AZURE_CLIENT_ID              — UAMI client ID (optional; triggers ManagedIdentity)
  SMTP_USER                    — SMTP sender address
  SMTP_PASSWORD                — Zoho App Password
  SMTP_HOST                    — SMTP server (default: smtppro.zoho.com)
  JOBS_NOTIFY_EMAIL            — notification destination (default: jobs@terian-services.com)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import smtplib
import uuid
from datetime import datetime, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT      = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE      = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_JOBS_CONTAINER       = "jobs"
_APPLICATIONS_CTR     = "job_applications"

_BLOB_ENDPOINT        = os.getenv("AZURE_STORAGE_BLOB_ENDPOINT", "").rstrip("/")
_BLOB_CONTAINER       = "job-applications"

_SMTP_USER            = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD        = os.getenv("SMTP_PASSWORD")
_NOTIFY_TO            = os.getenv("JOBS_NOTIFY_EMAIL", "jobs@terian-services.com")
_FROM_NAME            = "Terian Services"
_SMTP_HOST            = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT            = 587

_MAX_RESUME_BYTES     = 10 * 1024 * 1024   # 10 MB
_ALLOWED_RESUME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


# ── Credential helper ─────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


# ── Cosmos helpers ────────────────────────────────────────────────────────────

async def _get_job(job_id: str) -> dict | None:
    if not _COSMOS_ENDPOINT:
        return None
    try:
        async with _credential() as cred:
            async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
                db = cosmos.get_database_client(_COSMOS_DATABASE)
                container = db.get_container_client(_JOBS_CONTAINER)
                item = await container.read_item(item=job_id, partition_key=job_id)
                return dict(item)
    except Exception as exc:
        logger.warning("jobs_router: could not fetch job %s: %s", job_id, exc)
        return None


async def _list_open_jobs() -> list[dict]:
    if not _COSMOS_ENDPOINT:
        return []
    try:
        async with _credential() as cred:
            async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
                db = cosmos.get_database_client(_COSMOS_DATABASE)
                container = db.get_container_client(_JOBS_CONTAINER)
                query = (
                    "SELECT c.id, c.title, c.tagline, c.location, c.type, "
                    "c.posted_at FROM c WHERE c.status = 'open'"
                )
                items = [item async for item in container.query_items(query=query)]
                return items
    except Exception as exc:
        logger.warning("jobs_router: could not list jobs: %s", exc)
        return []


async def _save_application(doc: dict) -> None:
    if not _COSMOS_ENDPOINT:
        logger.warning("jobs_router: AZURE_COSMOS_ENDPOINT not set — skipping application write")
        return
    async with _credential() as cred:
        async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
            db = cosmos.get_database_client(_COSMOS_DATABASE)
            container = db.get_container_client(_APPLICATIONS_CTR)
            await container.create_item(body=doc)
    logger.info("jobs_router: application saved id=%s job_id=%s", doc["id"], doc["job_id"])


# ── Blob helper ───────────────────────────────────────────────────────────────

async def _upload_resume(job_id: str, app_id: str, filename: str, content_type: str, data: bytes) -> str | None:
    if not _BLOB_ENDPOINT:
        logger.warning("jobs_router: AZURE_STORAGE_BLOB_ENDPOINT not set — skipping resume upload")
        return None
    blob_path = f"{job_id}/{app_id}/{filename}"
    try:
        async with _credential() as cred:
            async with BlobServiceClient(account_url=_BLOB_ENDPOINT, credential=cred) as svc:
                blob = svc.get_blob_client(container=_BLOB_CONTAINER, blob=blob_path)
                await blob.upload_blob(
                    data,
                    overwrite=True,
                    content_settings=ContentSettings(content_type=content_type),
                )
        logger.info("jobs_router: resume uploaded → %s/%s", _BLOB_CONTAINER, blob_path)
        return blob_path
    except Exception as exc:
        logger.warning("jobs_router: failed to upload resume for app %s: %s", app_id, exc)
        return None


# ── Email helper ──────────────────────────────────────────────────────────────

def _send_application_email_sync(
    job_title: str,
    app_id: str,
    name: str,
    email: str,
    linkedin_url: str,
    message: str,
    resume_filename: str,
    resume_content_type: str,
    resume_data: bytes,
) -> None:
    if not _SMTP_PASSWORD:
        logger.warning("jobs_router: SMTP_PASSWORD not set — skipping application email")
        return

    submitted_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    subject = f"[New Application] {name} — {job_title}"

    linkedin_row = (
        f"""<tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">LinkedIn</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="{linkedin_url}" style="color:#0d9488;text-decoration:none;">{linkedin_url}</a>
                </td>
              </tr>"""
        if linkedin_url else ""
    )

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
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Job Application</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">
              terian-services.com · Jobs
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              A new application has been submitted for <strong>{job_title}</strong>.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Applicant</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">Name</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{email}" style="color:#0d9488;text-decoration:none;">{email}</a>
                </td>
              </tr>
              {linkedin_row}
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Submitted</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{submitted_at}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Resume</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{resume_filename} (attached)</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;">Cover Note</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;
                        border-left:4px solid #0d9488;border-radius:6px;
                        padding:16px;font-size:14px;color:#374151;line-height:1.7;
                        white-space:pre-wrap;">{message}</div>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              Application ID: {app_id}
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

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = f"{_FROM_NAME} <{_SMTP_USER}>"
    msg["To"]      = _NOTIFY_TO

    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(html, "html"))
    msg.attach(body_part)

    maintype, _, subtype = resume_content_type.partition("/")
    part = MIMEBase(maintype or "application", subtype or "octet-stream")
    part.set_payload(resume_data)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename=resume_filename)
    msg.attach(part)

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_USER, [_NOTIFY_TO], msg.as_string())

    logger.info("jobs_router: application email sent → %s for app=%s", _NOTIFY_TO, app_id)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/jobs")
async def list_jobs() -> list[dict]:
    """Return all open job listings (summary fields only)."""
    return await _list_open_jobs()


@router.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    """Return a full job listing including sections[]."""
    job = await _get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    if job.get("status") != "open":
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' is no longer open.")
    return job


@router.post("/api/jobs/{job_id}/apply")
async def apply_for_job(
    job_id:       str,
    name:         str           = Form(..., min_length=1, max_length=200),
    email:        str           = Form(...),
    linkedin_url: Optional[str] = Form(default=""),
    message:      str           = Form(..., min_length=1, max_length=5000),
    resume:       UploadFile    = File(...),
) -> dict:
    """
    Submit a job application. Accepts multipart/form-data with a resume file.
    Saves to CosmosDB, uploads resume to blob storage, sends notification email.
    """
    # ── Validate job exists ───────────────────────────────────────────────────
    job = await _get_job(job_id)
    if job is None or job.get("status") != "open":
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found or no longer open.")

    # ── Validate resume ───────────────────────────────────────────────────────
    if not resume.filename:
        raise HTTPException(status_code=400, detail="Resume file is required.")

    content_type = resume.content_type or "application/octet-stream"
    if content_type not in _ALLOWED_RESUME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Resume must be a PDF or Word document (.pdf, .doc, .docx).",
        )

    resume_data = await resume.read()
    if len(resume_data) > _MAX_RESUME_BYTES:
        raise HTTPException(status_code=400, detail="Resume exceeds the 10 MB limit.")

    # ── Save application to CosmosDB ──────────────────────────────────────────
    app_id = str(uuid.uuid4())
    doc = {
        "id":           app_id,
        "job_id":       job_id,
        "job_title":    job.get("title", ""),
        "name":         name,
        "email":        email,
        "linkedin_url": linkedin_url or "",
        "message":      message,
        "resume_name":  resume.filename,
        "resume_type":  content_type,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await _save_application(doc)
    except Exception as exc:
        logger.exception("jobs_router: Cosmos write failed for app=%s: %s", app_id, exc)
        raise HTTPException(
            status_code=502,
            detail="Could not save your application. Please try again or email jobs@terian-services.com.",
        )

    # ── Upload resume to blob (best-effort) ───────────────────────────────────
    safe_filename = re.sub(r"[^\w.\-]", "_", resume.filename)
    blob_path = await _upload_resume(job_id, app_id, safe_filename, content_type, resume_data)
    if blob_path:
        doc["resume_blob_path"] = blob_path
        try:
            async with _credential() as cred:
                async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
                    db = cosmos.get_database_client(_COSMOS_DATABASE)
                    container = db.get_container_client(_APPLICATIONS_CTR)
                    await container.replace_item(item=app_id, body=doc, partition_key=job_id)
        except Exception as exc:
            logger.warning("jobs_router: could not patch resume_blob_path into app %s: %s", app_id, exc)

    # ── Send notification email (best-effort) ─────────────────────────────────
    try:
        await asyncio.to_thread(
            _send_application_email_sync,
            job.get("title", job_id),
            app_id,
            name,
            email,
            linkedin_url or "",
            message,
            safe_filename,
            content_type,
            resume_data,
        )
    except Exception as exc:
        logger.warning("jobs_router: application email failed (application saved): %s", exc)

    return {"ok": True, "id": app_id}
