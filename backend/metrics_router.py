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
  Monitoring Reader on the App Insights component resource).

  When AZURE_CLIENT_ID is set (automatically wired by Terraform to the UAMI
  client ID), ManagedIdentityCredential is used instead so ACA picks the
  correct identity unambiguously.

  Querying
  Uses LogsQueryClient.query_resource() targeting the App Insights ARM
  resource ID (APPINSIGHTS_RESOURCE_ID env var) rather than the backing
  Log Analytics workspace GUID — matching how Grafana queries the same data.

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

RESOURCE_ID = os.getenv("APPINSIGHTS_RESOURCE_ID", "")
CACHE_TTL_SECONDS = int(os.getenv("METRICS_CACHE_TTL", "300"))  # 5 minutes

_cache: dict[str, Any] = {}

# ── KQL queries ─────────────────────────────────────────────────────────────

# Hourly time-series: total requests, failures, avg duration over last 24h
_HOURLY_KQL = """
requests
| where name !startswith "HEAD /health"
| where name !startswith "OPTIONS "
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
| where name !startswith "HEAD /health"
| where name !startswith "OPTIONS "
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
    response = client.query_resource(
        resource_id=RESOURCE_ID,
        query=kql,
        timespan=timedelta(hours=24),
    )
    # PARTIAL means some sub-queries failed (e.g. isfuzzy skipped a missing table);
    # the data we do have is still usable.
    if response.status == LogsQueryStatus.FAILURE:
        raise RuntimeError(f"App Insights query failed: {response.partial_error}")
    if not response.tables:
        return []
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
    if not RESOURCE_ID:
        raise HTTPException(
            status_code=503,
            detail="Metrics endpoint is not configured (APPINSIGHTS_RESOURCE_ID missing).",
        )

    now = time.monotonic()
    cached = _cache.get("awards")
    if cached and now - cached["ts"] < CACHE_TTL_SECONDS:
        return cached["data"]

    _empty_summary: dict[str, Any] = {
        "total": 0, "failures": 0, "p50_ms": 0, "p95_ms": 0,
    }

    try:
        client = LogsQueryClient(_credential())
        hourly = _query(client, _HOURLY_KQL)
        summary_rows = _query(client, _SUMMARY_KQL)
        summary = summary_rows[0] if summary_rows else _empty_summary
    except Exception as exc:
        # Metrics are best-effort on this marketing page — log and return zeros
        # rather than propagating a 502 to visitors.
        logger.warning("App Insights query unavailable, returning zeros: %s", exc)
        hourly = []
        summary = _empty_summary

    data: dict[str, Any] = {
        "summary": summary,
        "hourly": hourly,
    }
    _cache["awards"] = {"ts": now, "data": data}
    return data
