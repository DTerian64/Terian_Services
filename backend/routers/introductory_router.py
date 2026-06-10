"""
introductory_router.py
───────────────────────
Public "Download presentation" CTA endpoint for the marketing site.

Rather than serving a static deck, this generates a personalised Award
Nomination onboarding presentation on demand — reusing the exact same
template-substitution pipeline as the engagement registration flow and the
Ask AI chatbot (PresentationAgent.generate_award_onboarding /
generate_from_template). This keeps a single source of truth
(blob_templates/award_nomination_onboarding_template.pptx) for both the
initial-inquiry and engagement-onboarding audiences.

POST /api/introductory/{service_id}/presentation-deck
  Body: {"org_name": "<organisation name>"}   — required, non-empty

  200 — pptx bytes (Content-Disposition: attachment)
  404 — unknown service_id
  422 — org_name missing/empty
  503 — AZURE_STORAGE_BLOB_ENDPOINT not configured
  500 — unexpected generation/blob error

Side effects
  • A copy of the generated deck is archived to
    engagement-assets/chatbot/{org-slug}-award-nomination-presentation.pptx
    (handled inside generate_from_template via company_copy_slug — same
    archive used by the engagement worker and chatbot paths).
  • A lead-capture document is written (fire-and-forget) to the
    `intro_requests` CosmosDB container so sales can see who has shown
    interest, even if they never complete full engagement intake.
  • A "[New Intro Request]" notification email is sent (fire-and-forget,
    same styling as the "[New Engagement]" email in
    engagement_intake_router.py) to CONTACT_NOTIFY_EMAIL.

Environment variables
  AZURE_STORAGE_BLOB_ENDPOINT   — blob service endpoint (via PresentationAgent)
  AZURE_COSMOS_ENDPOINT         — Cosmos DB endpoint (lead capture)
  AZURE_COSMOS_DATABASE         — database name (default: terian-services)
  SMTP_USER                     — SMTP sender address (sales@terian-services.com)
  SMTP_PASSWORD                 — Zoho App Password (from Key Vault)
  SMTP_HOST                     — SMTP server (default: smtppro.zoho.com)
  CONTACT_NOTIFY_EMAIL          — notification destination (default: SMTP_USER)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

from agents.presentation_agent import PresentationAgent, normalize_org_name

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_INTRO_REQUESTS_CTR = "intro_requests"

_PPTX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)

# service_id → human label, used for the downloaded filename.
_SERVICE_LABELS: dict[str, str] = {
    "award-nomination": "Award_Nomination_Overview",
}

# service_id → human display name, used in the sales notification email.
_SERVICE_DISPLAY_NAMES: dict[str, str] = {
    "award-nomination": "Award Nomination System",
}

# ── SMTP config (mirrors engagement_intake_router.py) ─────────────────────────

_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", "sales@terian-services.com")
_FROM_NAME     = "Terianix.ai"
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT     = 587


# ── Credential helper (mirrors agents/skills/presentation/tools.py) ──────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


# ── PresentationAgent singleton ───────────────────────────────────────────────
# Constructed lazily so import-time errors surface as 500s on first call
# rather than crashing the process at boot.
_agent: PresentationAgent | None = None


def _get_agent() -> PresentationAgent:
    global _agent
    if _agent is None:
        _agent = PresentationAgent()
    return _agent


# ── Schemas ───────────────────────────────────────────────────────────────────

class PresentationDeckRequest(BaseModel):
    org_name: str = Field(..., min_length=1, max_length=200)

    @field_validator("org_name")
    @classmethod
    def _org_name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("org_name must not be blank")
        return v


# ── Lead capture (fire-and-forget) ────────────────────────────────────────────

async def _save_intro_request(service_id: str, org_name: str, blob_path: str) -> None:
    """
    Write a lead-capture document to the intro_requests CosmosDB container.

    Failures are logged but never raised — a persistence hiccup must never
    break the download the visitor is waiting on.
    """
    if not _COSMOS_ENDPOINT:
        logger.warning("introductory_router: AZURE_COSMOS_ENDPOINT not set — skipping intro_requests write")
        return
    doc = {
        "id":           str(uuid.uuid4()),
        "service_id":   service_id,
        "org_name":     org_name,
        "blob_path":    blob_path,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with _credential() as cred:
            async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
                db = cosmos.get_database_client(_COSMOS_DATABASE)
                container = db.get_container_client(_INTRO_REQUESTS_CTR)
                await container.create_item(body=doc)
        logger.info("introductory_router: intro_requests recorded for org=%r service=%r", org_name, service_id)
    except Exception as exc:
        logger.error("introductory_router: failed to write intro_requests doc: %s", exc, exc_info=True)


# ── Sales notification (fire-and-forget) ──────────────────────────────────────

def _send_intro_notification_sync(service_id: str, org_name: str, archive_path: str) -> None:
    """
    Send a "[New Intro Request]" notification email to CONTACT_NOTIFY_EMAIL.

    Styling mirrors the "[New Engagement]" notification in
    engagement_intake_router.py (same purple gradient header / summary table /
    footer) so both land in sales@ with a consistent look.

    Runs in asyncio.to_thread. Failures are logged but never raised — an SMTP
    hiccup must never break the download the visitor is waiting on.
    """
    if not _SMTP_PASSWORD:
        logger.warning("introductory_router: SMTP_PASSWORD not set — skipping intro notification email")
        return

    service_display = _SERVICE_DISPLAY_NAMES.get(service_id, service_id)
    requested_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    subject = f"[New Intro Request] {org_name} — {service_display}"
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
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Intro Request</h1>
            <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;">
              terianix.ai
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              A visitor downloaded a personalised presentation from the
              marketing site's "Download presentation" CTA.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Request</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{org_name}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Service</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#8b5cf6;">{service_display}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Requested At</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{requested_at}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Archived Deck</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{archive_path}</td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              This is a lead-capture notification only — no contact details
              were collected. The visitor's deck is archived under
              engagement-assets/{archive_path}.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terianix.ai · terianix.ai
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
    msg["To"]      = _NOTIFY_TO
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
            server.starttls()
            server.login(_SMTP_USER, _SMTP_PASSWORD)
            server.sendmail(_SMTP_USER, [_NOTIFY_TO], msg.as_string())
        logger.info("introductory_router: intro notification sent → %s", _NOTIFY_TO)
    except Exception as exc:
        logger.error("introductory_router: failed to send intro notification email: %s", exc, exc_info=True)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/api/introductory/{service_id}/presentation-deck")
async def introductory_presentation_deck(service_id: str, body: PresentationDeckRequest) -> Response:
    """Generate and stream a personalised onboarding deck for the given service."""
    label = _SERVICE_LABELS.get(service_id)
    if label is None:
        raise HTTPException(
            status_code=404,
            detail=f"No presentation deck available for service '{service_id}'.",
        )

    org_name = body.org_name

    try:
        result = await _get_agent().generate_award_onboarding({"org_name": org_name})
    except EnvironmentError as exc:
        logger.error("introductory_router: blob storage not configured: %s", exc)
        raise HTTPException(status_code=503, detail="Presentation generation is temporarily unavailable.")
    except Exception as exc:
        logger.exception("introductory_router: failed to generate deck for org=%r: %s", org_name, exc)
        raise HTTPException(status_code=500, detail="Could not generate presentation.")

    # Lead capture — fire-and-forget, never blocks the download.
    asyncio.ensure_future(_save_intro_request(service_id, org_name, result.blob_path))

    # Strip legal-entity suffixes (Inc., LLC, Ltd, ...) before slugging, so
    # "Acme Corp, LLC" -> "Acme" rather than "Acme-Corp-LLC" / "Acme_Corp_LLC".
    display_name = normalize_org_name(org_name)
    org_slug = re.sub(r"[^A-Za-z0-9]+", "_", display_name).strip("_") or "Organisation"
    filename = f"Terian_{org_slug}_{label}.pptx"

    # Mirrors the subdomain slug derived in
    # presentation_agent.generate_award_onboarding() — the stable path the
    # archival "company copy" was saved to via company_copy_slug.
    subdomain = re.sub(r"[^a-z0-9]+", "-", display_name.lower()).strip("-") or "your-company"
    archive_path = f"chatbot/{subdomain}-award-nomination-presentation.pptx"

    # Sales notification — fire-and-forget, same styling as [New Engagement].
    asyncio.ensure_future(
        asyncio.to_thread(_send_intro_notification_sync, service_id, org_name, archive_path)
    )

    return Response(
        content=result.pptx_bytes,
        media_type=_PPTX_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
