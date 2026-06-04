"""
metrics_router.py
─────────────────
FastAPI router that exposes Azure Monitor / Application Insights metrics
for the Award Nomination System showcase page.

GET /api/metrics/awards
  Returns last-24h App Insights KQL data plus Azure Monitor metrics for
  compute and database resources. Response shape:

    {
      "summary": { total, failures, p50_ms, p95_ms },
      "hourly":  [ { timestamp, total, failures, avg_ms }, … ],
      "health":  { total, failures, p95_ms, unique_users, pages_viewed,
                   nominations, sessions },
      "compute": { aca_primary, aca_secondary, sql_mb }
    }

Authentication
  Uses DefaultAzureCredential locally (az login) or ManagedIdentityCredential
  in ACA (AZURE_CLIENT_ID env var set by Terraform to the UAMI client ID).
  The UAMI must have Monitoring Reader on the App Insights component, the
  backing Log Analytics workspace, both ACA resources, and the SQL database.

Caching
  All data is cached in-process for CACHE_TTL_SECONDS (default 5 min).

Performance
  All 6 independent network calls (3 KQL + 3 Azure Monitor metrics) are
  executed concurrently via asyncio.gather + asyncio.to_thread, reducing
  cold-path latency from the sum of all calls to the slowest single call.
  The two single-row requests-table KQL queries are merged into one.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.monitor.query import LogsQueryClient, LogsQueryStatus
from azure.mgmt.monitor import MonitorManagementClient
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

RESOURCE_ID          = os.getenv("APPINSIGHTS_RESOURCE_ID", "")
FRONTEND_RESOURCE_ID = os.getenv("AWARD_APPI_FRONTEND_RESOURCE_ID", "")
CACHE_TTL_SECONDS    = int(os.getenv("METRICS_CACHE_TTL", "300"))  # 5 minutes

_ACA_PRIMARY_ID   = os.getenv("AWARD_ACA_PRIMARY_RESOURCE_ID", "")
_ACA_SECONDARY_ID = os.getenv("AWARD_ACA_SECONDARY_RESOURCE_ID", "")
_SQL_DB_ID        = os.getenv("AWARD_SQL_DB_RESOURCE_ID", "")

_cache: dict[str, Any] = {}

# ── KQL queries ───────────────────────────────────────────────────────────────

# Hourly time-series: total requests, failures, avg duration over last 24h
_HOURLY_KQL = """
requests
| where name !startswith "HEAD /health"
| where name !startswith "OPTIONS "
| summarize
    total    = count(),
    failures = countif(success == false),
    avg_ms   = round(avg(duration))
  by bin(timestamp, 1h)
| order by timestamp asc
"""

# Merged single-row query: summary percentiles + nomination/session counts.
# Both previously queried the `requests` table — combined into one round trip.
_SUMMARY_AND_ACTIVITY_KQL = """
requests
| where name !startswith "HEAD /health"
| where name !startswith "OPTIONS "
| summarize
    total       = count(),
    failures    = countif(success == false),
    p50_ms      = round(percentile(duration, 50)),
    p95_ms      = round(percentile(duration, 95)),
    nominations = countif(name == "POST /api/nominations" and success == true),
    sessions    = dcount(session_Id)
"""

# Page view counts and unique session count — lives in the frontend App Insights
_PAGEVIEWS_KQL = """
pageViews
| summarize
    pages_viewed = count(),
    unique_users = dcount(session_Id)
"""


# ── Credential + sync query helpers ──────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


def _run_kql(kql: str, resource_id: str) -> list[dict]:
    """
    Execute one KQL query synchronously — intended for asyncio.to_thread.
    Creates its own LogsQueryClient so concurrent calls don't share state.
    """
    client = LogsQueryClient(_credential())
    response = client.query_resource(
        resource_id=resource_id,
        query=kql,
        timespan=timedelta(hours=24),
    )
    if response.status == LogsQueryStatus.FAILURE:
        raise RuntimeError(f"App Insights KQL failed: {response.partial_error}")
    if not response.tables:
        return []
    table = response.tables[0]
    cols = [col if isinstance(col, str) else col.name for col in table.columns]
    rows = []
    for row in table.rows:
        record = dict(zip(cols, row))
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
        rows.append(record)
    return rows


def _run_metric(resource_id: str, metric_name: str, aggregation: str = "Average") -> float:
    """
    Query a single Azure Monitor metric synchronously — intended for asyncio.to_thread.
    Returns 0.0 if the resource ID is not configured or the query fails.
    """
    resource_short = resource_id.split("/")[-1] if resource_id else "<not set>"

    if not resource_id:
        logger.warning("metrics: resource_id not set for metric %s — returning 0", metric_name)
        return 0.0
    try:
        parts  = resource_id.split("/")
        sub_id = parts[parts.index("subscriptions") + 1]
        end    = datetime.now(timezone.utc)
        start  = end - timedelta(days=1)
        timespan = f"{start.isoformat()}/{end.isoformat()}"

        logger.info("metrics: querying %s / %s / %s", resource_short, metric_name, aggregation)
        client = MonitorManagementClient(_credential(), sub_id)
        result = client.metrics.list(
            resource_uri=resource_id,
            metricnames=metric_name,
            aggregation=aggregation,
            timespan=timespan,
            interval="PT1H",
        )
        attr = aggregation.lower()
        for metric in result.value:
            for ts in metric.timeseries:
                for dp in reversed(ts.data):
                    val = getattr(dp, attr, None)
                    if val is not None:
                        logger.info("metrics: %s / %s = %s", resource_short, metric_name, val)
                        return float(val)
        logger.warning("metrics: %s / %s — no non-null data points in last 24h", resource_short, metric_name)
        return 0.0
    except Exception as exc:
        logger.warning("metrics: %s / %s — exception: %s", resource_short, metric_name, exc)
        return 0.0


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/api/metrics/awards")
async def awards_metrics() -> dict:
    """
    Last-24h metrics for the Award Nomination System.
    Served from an in-process cache; refreshes at most every 5 minutes.

    All 6 network calls are fired concurrently — total latency equals the
    slowest individual call rather than the sum of all calls.
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

    t_start = time.monotonic()

    # ── Zero-value defaults ───────────────────────────────────────────────────
    _empty_summary: dict[str, Any] = {
        "total": 0, "failures": 0, "p50_ms": 0, "p95_ms": 0,
    }
    _empty_health: dict[str, Any] = {
        "total": 0, "failures": 0, "p95_ms": 0,
        "unique_users": 0, "pages_viewed": 0, "nominations": 0, "sessions": 0,
    }
    _empty_compute: dict[str, Any] = {
        "aca_primary": 0, "aca_secondary": 0, "sql_mb": 0.0,
    }

    pv_resource = FRONTEND_RESOURCE_ID if FRONTEND_RESOURCE_ID else RESOURCE_ID

    # ── Fire all 6 calls concurrently ────────────────────────────────────────
    # Each runs in its own thread so the sync SDK doesn't block the event loop.
    (
        hourly_result,
        summary_result,
        pv_result,
        aca_primary_result,
        aca_secondary_result,
        sql_result,
    ) = await asyncio.gather(
        asyncio.to_thread(_run_kql, _HOURLY_KQL,                  RESOURCE_ID),
        asyncio.to_thread(_run_kql, _SUMMARY_AND_ACTIVITY_KQL,    RESOURCE_ID),
        asyncio.to_thread(_run_kql, _PAGEVIEWS_KQL,               pv_resource),
        asyncio.to_thread(_run_metric, _ACA_PRIMARY_ID,   "Replicas", "Average"),
        asyncio.to_thread(_run_metric, _ACA_SECONDARY_ID, "Replicas", "Average"),
        asyncio.to_thread(_run_metric, _SQL_DB_ID,        "storage",  "Maximum"),
        return_exceptions=True,   # don't let one failure cancel the others
    )

    logger.info("metrics: all calls completed in %.0f ms", (time.monotonic() - t_start) * 1000)

    # ── Unpack KQL results (replace exceptions with empty lists) ──────────────
    def _rows(result: Any, label: str) -> list[dict]:
        if isinstance(result, Exception):
            logger.warning("metrics: %s query failed — %s", label, result)
            return []
        return result  # type: ignore[return-value]

    hourly        = _rows(hourly_result,  "hourly")
    summary_rows  = _rows(summary_result, "summary+activity")
    pv_rows       = _rows(pv_result,      "pageviews")

    combined = summary_rows[0] if summary_rows else {}
    pv       = pv_rows[0]      if pv_rows      else {}

    summary: dict[str, Any] = {
        "total":    combined.get("total",    0),
        "failures": combined.get("failures", 0),
        "p50_ms":   combined.get("p50_ms",   0),
        "p95_ms":   combined.get("p95_ms",   0),
    }
    health: dict[str, Any] = {
        "total":        combined.get("total",       0),
        "failures":     combined.get("failures",    0),
        "p95_ms":       combined.get("p95_ms",      0),
        "unique_users": pv.get("unique_users",      0),
        "pages_viewed": pv.get("pages_viewed",      0),
        "nominations":  combined.get("nominations", 0),
        "sessions":     combined.get("sessions",    0),
    }

    # ── Unpack Azure Monitor results (replace exceptions with 0.0) ────────────
    def _num(result: Any, label: str) -> float:
        if isinstance(result, Exception):
            logger.warning("metrics: %s metric failed — %s", label, result)
            return 0.0
        return float(result)  # type: ignore[arg-type]

    sql_bytes = _num(sql_result,         "sql_storage")
    compute: dict[str, Any] = {
        "aca_primary":   int(round(_num(aca_primary_result,   "aca_primary"))),
        "aca_secondary": int(round(_num(aca_secondary_result, "aca_secondary"))),
        "sql_mb":        round(sql_bytes / (1024 * 1024), 2) if sql_bytes else 0.0,
    }

    data: dict[str, Any] = {
        "summary": summary,
        "hourly":  hourly,
        "health":  health,
        "compute": compute,
    }
    _cache["awards"] = {"ts": now, "data": data}
    return data
