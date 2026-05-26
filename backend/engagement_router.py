"""
engagement_router.py
────────────────────
Public endpoint returning pricing / engagement details for a given
Terian Services product or service.

GET /api/engagement/{service_id}
  Returns the full engagement document from CosmosDB (tiers, feature
  groups, services note).  The document is served as-is so the frontend
  can render whatever structure is stored without any backend changes.

  service_id — URL-friendly slug, e.g. "award-nomination"

  200 — engagement document (dict)
  404 — service not found
  503 — CosmosDB endpoint not configured
  500 — unexpected error
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from engagement_service import get_engagement

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/engagement/{service_id}")
async def engagement(service_id: str) -> JSONResponse:
    """Return pricing and engagement details for the requested service slug."""
    doc = await get_engagement(service_id)
    # Strip CosmosDB internal fields before sending to the browser.
    clean = {
        k: v
        for k, v in doc.items()
        if not k.startswith("_")
    }
    return JSONResponse(content=clean)
