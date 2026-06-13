"""
engagement_worker.py
────────────────────
Async background worker that processes engagement intake jobs from the
Azure Storage Queue and delivers a personalised onboarding PPTX to the
requester (Email #2).

Flow for each queue message
───────────────────────────
  1. Receive message from `engagement-intake` queue
     (visibility timeout = 120 s — message hidden while being processed)
  2. Parse JSON payload (engagement_id, email, org_name, …)
  3. Call Azure OpenAI to generate slide content tailored to the engagement
  4. Build a .pptx deck from scratch using python-pptx + Terian palette
  5. Upload deck to Blob Storage: engagement-assets/{engagement_id}/onboarding.pptx
  6. Send Email #2 to requester with the PPTX attached
  7. Update client_engagements CosmosDB document: presentation_sent = true
  8. Delete the queue message (ack)

Error handling
──────────────
  If any step raises after _MAX_ATTEMPTS retries (tracked via dequeue_count
  on the message), the worker:
    • Writes a failed_engagement_jobs document to CosmosDB
    • Sends an alert to sales@ so a human can follow up manually
    • Deletes the poison message so it does not loop forever

The worker polls on a short interval when the queue is empty and immediately
re-checks after processing a message (burst drain). A graceful shutdown flag
lets the FastAPI lifespan stop it cleanly.

Environment variables (all already injected by Terraform)
──────────────────────────────────────────────────────────
  AZURE_STORAGE_QUEUE_ENDPOINT   — queue service endpoint
  ENGAGEMENT_INTAKE_QUEUE_NAME   — queue name (default: engagement-intake)
  AZURE_STORAGE_BLOB_ENDPOINT    — blob service endpoint
  ENGAGEMENT_ASSETS_CONTAINER    — blob container (default: engagement-assets)
  AZURE_COSMOS_ENDPOINT          — Cosmos DB endpoint
  AZURE_COSMOS_DATABASE          — database name (default: terian-services)
  AZURE_OPENAI_KEY               — Azure OpenAI key
  AZURE_OPENAI_ENDPOINT          — Azure OpenAI endpoint
  AZURE_OPENAI_MODEL             — deployment name (default: gpt-4.1)
  AZURE_OPENAI_API_VERSION       — API version (default: 2024-12-01-preview)
  SMTP_USER                      — SMTP sender address (sales@terian-services.com)
  SMTP_PASSWORD                  — Zoho App Password (from Key Vault)
  SMTP_HOST                      — SMTP server (default: smtppro.zoho.com)
  CONTACT_NOTIFY_EMAIL           — sales alert destination
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from azure.storage.queue.aio import QueueClient

from agents.presentation_agent import PresentationAgent
from services.email_template_service import get_template, render
from services.engagement_service import get_engagement_by_service

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

_QUEUE_ENDPOINT   = os.getenv("AZURE_STORAGE_QUEUE_ENDPOINT", "")
_QUEUE_NAME       = os.getenv("ENGAGEMENT_INTAKE_QUEUE_NAME", "engagement-intake")
_COSMOS_ENDPOINT  = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE  = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_ENGAGEMENTS_CTR  = "client_engagements"
_FAILED_JOBS_CTR  = "failed_engagement_jobs"

_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", "sales@terian-services.com")
_DEFAULT_FROM_NAME = "Terian Services"
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT     = 587

_MAX_ATTEMPTS    = 5    # dequeue_count threshold before dead-lettering
_POLL_INTERVAL_S = 8    # seconds to wait when queue is empty
_VISIBILITY_S    = 120  # seconds a message stays hidden during processing


# ── Credential helper (mirrors engagement_intake_router.py) ───────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


# ── Email #2 ──────────────────────────────────────────────────────────────────

def _send_pptx_email_sync(
    subject: str,
    html_body: str,
    to_addr: str,
    pptx_bytes: bytes,
    org_name: str,
    from_name: str,
) -> None:
    """
    Send the onboarding-presentation email with the PPTX attached.

    subject/html_body are pre-rendered from the engagement's
    `user_presentation_email` CosmosDB template (services/email_template_service.py).
    from_name is the per-service `notifications.sending_corporation` value
    ("Terianix.ai" or "Terian Services") — only the From: display name
    differs per service; both share the same Zoho mailbox/credentials.

    Runs in asyncio.to_thread.
    """
    if not _SMTP_PASSWORD:
        logger.warning("worker: SMTP_PASSWORD not set — skipping Email #2")
        return

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = f"{from_name} <{_SMTP_USER}>"
    msg["To"]      = to_addr

    msg.attach(MIMEText(html_body, "html"))

    # Attach PPTX
    part = MIMEBase(
        "application",
        "vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    part.set_payload(pptx_bytes)
    encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        "attachment",
        filename=f"{from_name.replace(' ', '_')}_{org_name.replace(' ', '_')}_Onboarding.pptx",
    )
    msg.attach(part)

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_USER, [to_addr], msg.as_string())

    logger.info("worker: Email #2 sent → %s", to_addr)


async def _send_presentation_email(job: dict, pptx_bytes: bytes) -> None:
    """
    Resolve the per-service notifications config + `user_presentation_email`
    template from CosmosDB, render it with the job's fields, and send
    Email #2 with the PPTX attached.

    Skip + log (non-fatal) if:
      - no engagement_details document matches job["engagement_type"]
      - that document has no `notifications` block
      - the referenced email_templates document is missing
    """
    engagement_type = job.get("engagement_type", "")

    engagement_doc = await get_engagement_by_service(engagement_type)
    if not engagement_doc or "notifications" not in engagement_doc:
        logger.warning(
            "worker: no notifications config for engagement_type '%s' — skipping Email #2",
            engagement_type,
        )
        return

    notifications = engagement_doc["notifications"]
    sending_corporation = notifications.get("sending_corporation", _DEFAULT_FROM_NAME)

    template_type = notifications.get("user_presentation_email")
    if not template_type:
        logger.warning(
            "worker: no user_presentation_email configured for '%s' — skipping Email #2",
            engagement_type,
        )
        return

    template = await get_template(template_type)
    if not template:
        return

    full_name = job.get("full_name", "")
    org_name  = job.get("org_name", "your organisation")

    tokens = {
        "first_name":      full_name.split()[0] if full_name.strip() else "there",
        "full_name":       full_name,
        "org_name":        org_name,
        "email":           job.get("email", ""),
        "industry":        job.get("industry", "") or "—",
        "user_count":      f"{job.get('user_count', 0):,}",
        "use_case":        job.get("use_case", ""),
        "tier_interest":   job.get("tier_interest", ""),
        "engagement_type": engagement_type,
        "account_id":      job.get("account_id", ""),
        "engagement_id":   job.get("engagement_id", ""),
    }

    subject, html_body = render(template, tokens)

    await asyncio.to_thread(
        _send_pptx_email_sync,
        subject, html_body, job["email"], pptx_bytes, org_name, sending_corporation,
    )


# ── CosmosDB helpers ──────────────────────────────────────────────────────────

async def _mark_presentation_sent(engagement_id: str, blob_path: str) -> None:
    """Patch client_engagements document: presentation_sent = true."""
    if not _COSMOS_ENDPOINT:
        return
    async with _credential() as cred:
        async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
            db = cosmos.get_database_client(_COSMOS_DATABASE)
            container = db.get_container_client(_ENGAGEMENTS_CTR)
            # Read first (needed to get partition key + etag for replace)
            # We query by id since we don't store account_id in the job payload
            # strictly as a pk — use cross-partition point read by id.
            query = "SELECT * FROM c WHERE c.id = @id"
            params = [{"name": "@id", "value": engagement_id}]
            items = [
                item
                async for item in container.query_items(
                    query=query, parameters=params
                )
            ]
            if not items:
                logger.warning("worker: engagement %s not found in CosmosDB", engagement_id)
                return
            doc = items[0]
            doc["presentation_sent"]    = True
            doc["presentation_blob"]    = blob_path
            doc["presentation_sent_at"] = datetime.now(timezone.utc).isoformat()
            await container.replace_item(item=doc["id"], body=doc)
    logger.info("worker: marked presentation_sent for engagement %s", engagement_id)


async def _write_failed_job(job: dict, error: str) -> None:
    """Write a dead-letter document to failed_engagement_jobs."""
    if not _COSMOS_ENDPOINT:
        logger.error("worker: dead-letter lost (no Cosmos endpoint) — %s", error)
        return
    try:
        async with _credential() as cred:
            async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
                db = cosmos.get_database_client(_COSMOS_DATABASE)
                container = db.get_container_client(_FAILED_JOBS_CTR)
                await container.create_item({
                    "id":            str(uuid.uuid4()),
                    "engagement_id": job.get("engagement_id", "unknown"),
                    "email":         job.get("email", ""),
                    "org_name":      job.get("org_name", ""),
                    "error":         error,
                    "failed_at":     datetime.now(timezone.utc).isoformat(),
                    "job_payload":   job,
                })
        logger.info("worker: dead-letter written for engagement %s", job.get("engagement_id"))
    except Exception as exc:
        logger.error("worker: failed to write dead-letter document: %s", exc)


# ── Alert email on dead-letter ────────────────────────────────────────────────

def _send_alert_sync(job: dict, error: str) -> None:
    """Notify sales@ when a job is dead-lettered — runs in asyncio.to_thread."""
    if not _SMTP_PASSWORD:
        return
    subject = f"[ACTION REQUIRED] Engagement worker failed — {job.get('org_name', 'unknown')}"
    body = (
        f"The engagement worker could not process a job after {_MAX_ATTEMPTS} attempts.\n\n"
        f"Engagement ID : {job.get('engagement_id')}\n"
        f"Requester     : {job.get('full_name')} <{job.get('email')}>\n"
        f"Organisation  : {job.get('org_name')}\n\n"
        f"Error: {error}\n\n"
        "The requester has already received their welcome email (Email #1) but\n"
        "has NOT received the onboarding deck. Please follow up manually."
    )
    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"]    = f"{_DEFAULT_FROM_NAME} <{_SMTP_USER}>"
    msg["To"]      = _NOTIFY_TO
    msg.attach(MIMEText(body, "plain"))
    try:
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
            server.starttls()
            server.login(_SMTP_USER, _SMTP_PASSWORD)
            server.sendmail(_SMTP_USER, [_NOTIFY_TO], msg.as_string())
    except Exception as exc:
        logger.error("worker: failed to send alert email: %s", exc)


# ── Single job processor ──────────────────────────────────────────────────────

async def _process_job(job: dict, engagement_id: str) -> None:
    """Process one engagement job end-to-end."""
    logger.info(
        "worker: processing engagement_id=%s org=%s",
        engagement_id, job.get("org_name"),
    )

    # 1 & 2 & 3. Generate PPTX + upload to Blob via PresentationAgent
    agent = PresentationAgent()
    result = await agent.generate(job)   # PresentationResult
    logger.info(
        "worker: pptx ready (%d bytes) → %s", len(result.pptx_bytes), result.blob_path
    )

    # 4. Send Email #2 with PPTX attached
    await _send_presentation_email(job, result.pptx_bytes)

    # 5. Update CosmosDB
    await _mark_presentation_sent(engagement_id, result.blob_path)

    logger.info("worker: job complete for engagement_id=%s", engagement_id)


# ── Main poll loop ────────────────────────────────────────────────────────────

async def run_worker(stop_event: asyncio.Event) -> None:
    """
    Long-running coroutine — call from FastAPI lifespan as an asyncio task.

    Polls the Storage Queue for engagement jobs, processes each one, and
    repeats until stop_event is set (on application shutdown).

    No-op if AZURE_STORAGE_QUEUE_ENDPOINT is not configured (local dev without
    Azure credentials).
    """
    if not _QUEUE_ENDPOINT:
        logger.warning(
            "worker: AZURE_STORAGE_QUEUE_ENDPOINT not set — engagement worker disabled"
        )
        return

    logger.info("worker: starting engagement worker (queue=%s)", _QUEUE_NAME)

    async with _credential() as cred:
        async with QueueClient(
            account_url=_QUEUE_ENDPOINT,
            queue_name=_QUEUE_NAME,
            credential=cred,
        ) as queue:
            while not stop_event.is_set():
                try:
                    messages = queue.receive_messages(
                        max_messages=1,
                        visibility_timeout=_VISIBILITY_S,
                    )
                    msg = None
                    async for m in messages:
                        msg = m
                        break

                    if msg is None:
                        # Queue empty — back off
                        await asyncio.sleep(_POLL_INTERVAL_S)
                        continue

                    # Parse payload
                    try:
                        job = json.loads(msg.content)
                    except json.JSONDecodeError as exc:
                        logger.error("worker: malformed queue message — deleting: %s", exc)
                        await queue.delete_message(msg)
                        continue

                    engagement_id = job.get("engagement_id", "unknown")
                    dequeue_count = msg.dequeue_count or 1

                    if dequeue_count > _MAX_ATTEMPTS:
                        # Poison message — dead-letter and delete
                        logger.error(
                            "worker: engagement %s exceeded max attempts (%d) — dead-lettering",
                            engagement_id, _MAX_ATTEMPTS,
                        )
                        error_msg = f"Exceeded {_MAX_ATTEMPTS} delivery attempts"
                        await _write_failed_job(job, error_msg)
                        await asyncio.to_thread(_send_alert_sync, job, error_msg)
                        await queue.delete_message(msg)
                        continue

                    # Process
                    try:
                        await _process_job(job, engagement_id)
                        await queue.delete_message(msg)
                    except Exception as exc:
                        logger.error(
                            "worker: engagement %s failed (attempt %d/%d): %s",
                            engagement_id, dequeue_count, _MAX_ATTEMPTS, exc,
                            exc_info=True,
                        )
                        # Message visibility will expire and become re-visible
                        # automatically — no explicit nack needed.

                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logger.error("worker: unexpected error in poll loop: %s", exc, exc_info=True)
                    await asyncio.sleep(_POLL_INTERVAL_S)

    logger.info("worker: engagement worker stopped")
