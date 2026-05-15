"""
metrics_router.py
─────────────────
FastAPI router that exposes Azure Monitor / Application Insights metrics
for the Award Nomination System showcase page.

GET /api/metrics/awards
  Returns the last-24h request volume, response time percentiles, and
  failure count drawn from the App Insights Log Analytics workspace.

Authentication
  Uses DefaultAzureCredential — managed identity in Azure Container Apps,
  Azure CLI credentials locally (run `az login` and ensure your account has
  Monitoring Reader on the App Insights resource).

  When AZURE_CLIENT_ID is set (automatically wired by Terraform to the UAMI
  client ID), ManagedIdentityCredential is used instead so ACA picks the
  correct identity unambiguously.

Caching
  Results are cached in-process for CACHE_TTL_SECONDS (default 5 min) to
  avoid hammering the App Insights API on every marketing-page load.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import timedelta
from typing import Any

from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.monitor.query import LogsQueryClient, LogsQueryStatus
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()

WORKSPACE_ID = os.getenv("APPINSIGHTS_WORKSPACE_ID", "")
CACHE_TTL_SECONDS = int(os.getenv("METRICS_CACHE_TTL", "300"))  # 5 minutes

_cache: dict[str, Any] = {}

# ── KQL queries ─────────────────────────────────────────────────────────────

# Hourly time-series: total requests, failures, avg duration over last 24h
_HOURLY_KQL = """
requests
| where timestamp > ago(24h)
| summarize
    total    = count(),
    failures = countif(success == false),
    avg_ms   = round(avg(duration))
  by bin(timestamp, 1h)
| order by timestamp asc
"""

# Single-row 24h summary: totals + response-time percentiles
_SUMMARY_KQL = """
requests
| where timestamp > ago(24h)
| summarize
    total    = count(),
    failures = countif(success == false),
    p50_ms   = round(percentile(duration, 50)),
    p95_ms   = round(percentile(duration, 95))
"""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


def _query(client: LogsQueryClient, kql: str) -> list[dict]:
    response = client.query_workspace(
        workspace_id=WORKSPACE_ID,
        query=kql,
        timespan=timedelta(hours=24),
    )
    if response.status != LogsQueryStatus.SUCCESS:
        raise RuntimeError(f"App Insights query failed: {response.partial_error}")
    table = response.tables[0]
    cols = [col.name for col in table.columns]
    rows = []
    for row in table.rows:
        record = dict(zip(cols, row))
        # Serialise datetime objects to ISO strings
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
        rows.append(record)
    return rows


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/api/metrics/awards")
async def awards_metrics() -> dict:
    """
    Last-24h metrics for the Award Nomination System.
    Served from an in-process cache; refreshes at most every 5 minutes.
    """
    if not WORKSPACE_ID:
        raise HTTPException(
            status_code=503,
            detail="Metrics endpoint is not configured (APPINSIGHTS_WORKSPACE_ID missing).",
        )

    now = time.monotonic()
    cached = _cache.get("awards")
    if cached and now - cached["ts"] < CACHE_TTL_SECONDS:
        return cached["data"]

    try:
        client = LogsQueryClient(_credential())
        hourly = _query(client, _HOURLY_KQL)
        summary_rows = _query(client, _SUMMARY_KQL)
    except Exception as exc:
        logger.exception("App Insights query failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve metrics from Application Insights.",
        )

    data: dict[str, Any] = {
        "summary": summary_rows[0] if summary_rows else {},
        "hourly": hourly,
    }
    _cache["awards"] = {"ts": now, "data": data}
    return data
