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
"""

from __future__ import annotations

import logging
import os
import time
from datetime import timedelta
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

# Single-row 24h summary: totals + response-time percentiles
_SUMMARY_KQL = """
requests
| where name !startswith "HEAD /health"
| where name !startswith "OPTIONS "
| summarize
    total    = count(),
    failures = countif(success == false),
    p50_ms   = round(percentile(duration, 50)),
    p95_ms   = round(percentile(duration, 95))
"""

# Page view counts and unique session count
_PAGEVIEWS_KQL = """
pageViews
| summarize
    pages_viewed = count(),
    unique_users = dcount(session_Id)
"""

# Successful nominations submitted + distinct user sessions across all requests
_ACTIVITY_KQL = """
requests
| summarize
    nominations = countif(name == "POST /api/nominations" and success == true),
    sessions    = dcount(session_Id)
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


def _query(client: LogsQueryClient, kql: str, resource_id: str | None = None) -> list[dict]:
    """Run a KQL query against an App Insights resource and return rows as dicts.

    ``resource_id`` defaults to the backend API App Insights (RESOURCE_ID).
    Pass an explicit value to target a different App Insights component
    (e.g. the frontend one for pageViews data).
    """
    response = client.query_resource(
        resource_id=resource_id or RESOURCE_ID,
        query=kql,
        timespan=timedelta(hours=24),
    )
    # FAILURE means all sub-queries failed — surface as exception.
    # PARTIAL means some data is available despite partial errors — use it.
    if response.status == LogsQueryStatus.FAILURE:
        raise RuntimeError(f"App Insights query failed: {response.partial_error}")
    if not response.tables:
        return []
    table = response.tables[0]
    # query_resource() returns columns as plain strings;
    # query_workspace() returns LogsTableColumn objects with a .name attribute.
    cols = [col if isinstance(col, str) else col.name for col in table.columns]
    rows = []
    for row in table.rows:
        record = dict(zip(cols, row))
        for k, v in record.items():
            if hasattr(v, "isoformat"):
                record[k] = v.isoformat()
        rows.append(record)
    return rows


def _metric(resource_id: str, metric_name: str, aggregation: str = "Average") -> float:
    """
    Query a single Azure Monitor metric for the last day via azure-mgmt-monitor.
    Returns 0.0 if the resource ID is not configured or the query fails.
    aggregation: 'Average' | 'Maximum' | 'Minimum' | 'Total' | 'Count'
    """
    if not resource_id:
        return 0.0
    try:
        # Extract subscription ID from the ARM resource ID.
        parts = resource_id.split("/")
        sub_id = parts[parts.index("subscriptions") + 1]

        from datetime import datetime, timezone as tz
        end   = datetime.now(tz.utc)
        start = end - timedelta(days=1)
        timespan = f"{start.isoformat()}/{end.isoformat()}"

        client = MonitorManagementClient(_credential(), sub_id)
        result = client.metrics.list(
            resource_uri=resource_id,
            metricnames=metric_name,
            aggregation=aggregation,
            timespan=timespan,
            interval="P1D",
        )
        attr = aggregation.lower()
        for metric in result.value:
            for ts in metric.timeseries:
                for dp in reversed(ts.data):
                    val = getattr(dp, attr, None)
                    if val is not None:
                        return float(val)
        return 0.0
    except Exception as exc:
        logger.warning("Azure Monitor metric unavailable (%s / %s): %s",
                       resource_id.split("/")[-1], metric_name, exc)
        return 0.0


# ── Endpoint ──────────────────────────────────────────────────────────────────

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

    # ── App Insights KQL queries ──────────────────────────────────────────────
    try:
        logs_client = LogsQueryClient(_credential())
        hourly        = _query(logs_client, _HOURLY_KQL)
        summary_rows  = _query(logs_client, _SUMMARY_KQL)
        # pageViews is emitted by the browser JS SDK — lives in the *frontend*
        # App Insights resource, not the backend API one.
        pv_resource   = FRONTEND_RESOURCE_ID if FRONTEND_RESOURCE_ID else RESOURCE_ID
        pv_rows       = _query(logs_client, _PAGEVIEWS_KQL, resource_id=pv_resource)
        activity_rows = _query(logs_client, _ACTIVITY_KQL)

        summary = summary_rows[0]  if summary_rows  else _empty_summary
        pv      = pv_rows[0]       if pv_rows        else {}
        act     = activity_rows[0] if activity_rows  else {}

        health: dict[str, Any] = {
            "total":        summary.get("total",    0),
            "failures":     summary.get("failures", 0),
            "p95_ms":       summary.get("p95_ms",   0),
            "unique_users": pv.get("unique_users",  0),
            "pages_viewed": pv.get("pages_viewed",  0),
            "nominations":  act.get("nominations",  0),
            "sessions":     act.get("sessions",     0),
        }
    except Exception as exc:
        logger.warning("App Insights query unavailable, returning zeros: %s", exc)
        hourly  = []
        summary = _empty_summary
        health  = _empty_health

    # ── Azure Monitor Metrics (ACA replicas + SQL storage) ───────────────────
    try:
        sql_bytes = _metric(_SQL_DB_ID, "storage", "Maximum")
        compute: dict[str, Any] = {
            "aca_primary":   int(round(_metric(_ACA_PRIMARY_ID,   "Replicas", "Average"))),
            "aca_secondary": int(round(_metric(_ACA_SECONDARY_ID, "Replicas", "Average"))),
            "sql_mb":        round(sql_bytes / (1024 * 1024), 2) if sql_bytes else 0.0,
        }
    except Exception as exc:
        logger.warning("Azure Monitor metrics unavailable: %s", exc)
        compute = _empty_compute

    data: dict[str, Any] = {
        "summary": summary,
        "hourly":  hourly,
        "health":  health,
        "compute": compute,
    }
    _cache["awards"] = {"ts": now, "data": data}
    return data
