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

Environment variables
  AZURE_STORAGE_BLOB_ENDPOINT   — blob service endpoint (via PresentationAgent)
  AZURE_COSMOS_ENDPOINT         — Cosmos DB endpoint (lead capture)
  AZURE_COSMOS_DATABASE         — database name (default: terian-services)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timezone

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

    # Strip legal-entity suffixes (Inc., LLC, Ltd, ...) before slugging the
    # filename, so "Acme Corp, LLC" -> "Terian_Acme_Award_..." rather than
    # "Terian_Acme_Corp_LLC_Award_...".
    org_slug = re.sub(r"[^A-Za-z0-9]+", "_", normalize_org_name(org_name)).strip("_") or "Organisation"
    filename = f"Terian_{org_slug}_{label}.pptx"

    return Response(
        content=result.pptx_bytes,
        media_type=_PPTX_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
