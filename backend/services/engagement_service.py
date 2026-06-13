"""
engagement_service.py
─────────────────────
CosmosDB read helper for the engagement_details container.

Each document represents one product or service's full pricing and
engagement model — tiers, feature groups, and services note.

Container : engagement_details
Partition : /service  (e.g. "Award Nomination")
Document  : one per product/service, keyed by slug id
            (e.g. id="award-nomination", service="Award Nomination")

Auth
  DefaultAzureCredential — UAMI in ACA, az-cli locally.

Caching
  Results are cached in memory for CACHE_TTL_SECONDS (300 s).
  A long TTL is intentional — pricing data changes rarely.
  Restart the container or wait for TTL expiry after updating CosmosDB.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_CONTAINER = "engagement_details"
CACHE_TTL_SECONDS = 300  # 5 minutes — pricing changes rarely

# ── In-memory cache (per service_id) ─────────────────────────────────────────

_cache: dict[str, dict] = {}
_cache_ts: dict[str, float] = {}


def _is_cache_valid(service_id: str) -> bool:
    return (
        service_id in _cache
        and (time.monotonic() - _cache_ts.get(service_id, 0.0)) < CACHE_TTL_SECONDS
    )


# ── Cosmos fetch ──────────────────────────────────────────────────────────────

async def get_engagement(service_id: str) -> dict[str, Any]:
    """
    Return the full engagement document for the given service slug.

    Args:
        service_id: URL-friendly slug, e.g. "award-nomination".

    Raises:
        HTTPException 404 — document not found.
        HTTPException 503 — AZURE_COSMOS_ENDPOINT not set.
        HTTPException 500 — unexpected Cosmos error.
    """
    if _is_cache_valid(service_id):
        logger.debug("engagement_service: cache hit for %s", service_id)
        return _cache[service_id]

    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        raise HTTPException(
            status_code=503,
            detail="AZURE_COSMOS_ENDPOINT is not configured.",
        )

    try:
        async with DefaultAzureCredential() as credential:
            async with CosmosClient(endpoint, credential=credential) as client:
                container = (
                    client
                    .get_database_client(database_name)
                    .get_container_client(_CONTAINER)
                )
                # Query by id; cross-partition because we don't have the
                # service value at query time (only the slug).
                query = "SELECT * FROM c WHERE c.id = @id"
                params = [{"name": "@id", "value": service_id}]
                results: list[dict] = []
                async for doc in container.query_items(
                    query=query,
                    parameters=params,
                ):
                    results.append(doc)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("engagement_service: Cosmos error for %s: %s", service_id, exc)
        raise HTTPException(
            status_code=500,
            detail="Could not load engagement data.",
        )

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No engagement document found for service '{service_id}'.",
        )

    doc = results[0]
    _cache[service_id] = doc
    _cache_ts[service_id] = time.monotonic()
    logger.info("engagement_service: loaded and cached '%s'", service_id)
    return doc


# ── Lookup by display name ────────────────────────────────────────────────────

async def get_engagement_by_service(engagement_type: str) -> dict[str, Any] | None:
    """
    Return the engagement document whose `service` field matches
    `engagement_type` exactly (e.g. "Award Nomination", "Contract Services").

    Unlike get_engagement, this does NOT raise on a miss — it returns None
    so callers (email senders) can skip + log rather than failing the
    request. This avoids needing to slugify the display string to derive
    the document id.

    Returns:
        The cached/fetched document, or None if:
          - AZURE_COSMOS_ENDPOINT is not configured
          - no document matches `engagement_type`
          - any Cosmos error occurs
    """
    cache_key = f"by_service:{engagement_type}"

    if _is_cache_valid(cache_key):
        logger.debug("engagement_service: cache hit for service '%s'", engagement_type)
        return _cache[cache_key]

    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        logger.warning(
            "engagement_service: AZURE_COSMOS_ENDPOINT not configured — "
            "skipping lookup for service '%s'", engagement_type,
        )
        return None

    try:
        async with DefaultAzureCredential() as credential:
            async with CosmosClient(endpoint, credential=credential) as client:
                container = (
                    client
                    .get_database_client(database_name)
                    .get_container_client(_CONTAINER)
                )
                query = "SELECT * FROM c WHERE c.service = @service"
                params = [{"name": "@service", "value": engagement_type}]
                results: list[dict] = []
                async for doc in container.query_items(
                    query=query,
                    parameters=params,
                ):
                    results.append(doc)
    except Exception as exc:
        logger.exception(
            "engagement_service: Cosmos error looking up service '%s': %s",
            engagement_type, exc,
        )
        return None

    if not results:
        logger.warning(
            "engagement_service: no engagement document found for service '%s'",
            engagement_type,
        )
        return None

    doc = results[0]
    _cache[cache_key] = doc
    _cache_ts[cache_key] = time.monotonic()
    logger.info("engagement_service: loaded and cached service '%s'", engagement_type)
    return doc
