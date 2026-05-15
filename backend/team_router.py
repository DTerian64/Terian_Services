"""
team_router.py
──────────────
FastAPI router serving the Terian Services team roster.

GET /api/team
  Returns all documents from the Cosmos DB `employees` container,
  ordered by a `sort_order` field (ascending) when present, otherwise
  by document insertion order as returned by the query.

Data source
  Azure Cosmos DB (SQL API) — serverless account `terian-services-cosmos-db`
  Database  : AZURE_COSMOS_DATABASE  (env var, default "terian-services")
  Container : employees
  Endpoint  : AZURE_COSMOS_ENDPOINT  (env var, injected by Terraform)

Auth
  ManagedIdentityCredential with AZURE_CLIENT_ID (UAMI) — no keys needed.
  Falls back to DefaultAzureCredential for local development (az login).

Caching
  Results are cached in memory for CACHE_TTL_SECONDS (60 s by default).
  Restart the container or wait for TTL expiry to pick up document changes.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

CACHE_TTL_SECONDS = 60

# ── Schema ────────────────────────────────────────────────────────────────────

class TeamMember(BaseModel):
    id: str
    name: str
    title: str
    bio: str
    photo_url: str
    linkedin_url: Optional[str] = None
    web_url: Optional[str] = None


# ── In-memory cache ───────────────────────────────────────────────────────────

_cache: list[TeamMember] | None = None
_cache_ts: float = 0.0


def _is_cache_valid() -> bool:
    return _cache is not None and (time.monotonic() - _cache_ts) < CACHE_TTL_SECONDS


def _doc_to_member(doc: dict[str, Any]) -> TeamMember:
    """Map a Cosmos DB document to a TeamMember, ignoring system fields."""
    return TeamMember(
        id=doc["id"],
        name=doc["name"],
        title=doc["title"],
        bio=doc["bio"],
        photo_url=doc["photo_url"],
        linkedin_url=doc.get("linkedin_url"),
        web_url=doc.get("web_url"),
    )


async def _fetch_from_cosmos() -> list[TeamMember]:
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        raise HTTPException(
            status_code=503,
            detail="AZURE_COSMOS_ENDPOINT is not configured.",
        )

    async with DefaultAzureCredential() as credential:
        async with CosmosClient(endpoint, credential=credential) as client:
            database = client.get_database_client(database_name)
            container = database.get_container_client("employees")

            # Sort by sort_order ascending. All documents must have this field;
            # the default Cosmos DB index policy (/*) covers it automatically.
            query = "SELECT * FROM c ORDER BY c.sort_order ASC"
            items: list[TeamMember] = []
            async for doc in container.query_items(query=query):
                try:
                    items.append(_doc_to_member(doc))
                except Exception as exc:
                    logger.warning("Skipping malformed employee document %s: %s", doc.get("id"), exc)

    logger.info("Fetched %d team member(s) from Cosmos DB", len(items))
    return items


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/api/team", response_model=list[TeamMember])
async def get_team() -> list[TeamMember]:
    """Returns all team members in display order."""
    global _cache, _cache_ts

    if _is_cache_valid():
        return _cache  # type: ignore[return-value]

    try:
        members = await _fetch_from_cosmos()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch team from Cosmos DB: %s", exc)
        raise HTTPException(status_code=500, detail="Could not load team data.")

    _cache = members
    _cache_ts = time.monotonic()
    return _cache
