"""
email_template_service.py
──────────────────────────
CosmosDB read helper for the email_templates container.

Each document represents one email template — a subject line and an HTML
body containing lowercase {{token}} placeholders that get substituted at
send time.

Container : email_templates
Partition : /template_type
Document  : one per template, id == template_type
            (e.g. "award-nomination-corporate-heads-up-email")

Auth
  DefaultAzureCredential — UAMI in ACA, az-cli locally.

Caching
  Results are cached in memory for CACHE_TTL_SECONDS (300 s), mirroring
  engagement_service.py. Restart the container or wait for TTL expiry
  after updating a template in CosmosDB.

Missing templates
  get_template returns None (does not raise) when a template is not found,
  Cosmos is not configured, or an error occurs. Callers should skip sending
  that email and log a warning — this keeps the existing fire-and-forget
  SMTP philosophy: a missing template should not fail the whole request.
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Any

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

_CONTAINER = "email_templates"
CACHE_TTL_SECONDS = 300  # 5 minutes — templates change rarely

# ── In-memory cache (per template_type) ──────────────────────────────────────

_cache: dict[str, dict] = {}
_cache_ts: dict[str, float] = {}


def _is_cache_valid(template_type: str) -> bool:
    return (
        template_type in _cache
        and (time.monotonic() - _cache_ts.get(template_type, 0.0)) < CACHE_TTL_SECONDS
    )


# ── Cosmos fetch ──────────────────────────────────────────────────────────────

async def get_template(template_type: str) -> dict[str, Any] | None:
    """
    Return the email template document for the given template_type.

    Returns None (instead of raising) if:
      - AZURE_COSMOS_ENDPOINT is not configured
      - no document matches template_type
      - any Cosmos error occurs

    Callers should treat None as "skip this email and log a warning" —
    consistent with the existing fire-and-forget SMTP error handling.
    """
    if _is_cache_valid(template_type):
        logger.debug("email_template_service: cache hit for %s", template_type)
        return _cache[template_type]

    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        logger.warning(
            "email_template_service: AZURE_COSMOS_ENDPOINT not configured — "
            "skipping template '%s'", template_type,
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
                query = "SELECT * FROM c WHERE c.template_type = @tt"
                params = [{"name": "@tt", "value": template_type}]
                results: list[dict] = []
                async for doc in container.query_items(
                    query=query,
                    parameters=params,
                ):
                    results.append(doc)
    except Exception as exc:
        logger.exception(
            "email_template_service: Cosmos error fetching '%s': %s",
            template_type, exc,
        )
        return None

    if not results:
        logger.warning(
            "email_template_service: no template found for '%s' — skipping email",
            template_type,
        )
        return None

    doc = results[0]
    _cache[template_type] = doc
    _cache_ts[template_type] = time.monotonic()
    logger.info("email_template_service: loaded and cached '%s'", template_type)
    return doc


# ── Token substitution ─────────────────────────────────────────────────────────

_TOKEN_RE = re.compile(r"\{\{(\w+)\}\}")


def render(template: dict[str, Any], tokens: dict[str, str]) -> tuple[str, str]:
    """
    Substitute {{token}} placeholders in the template's subject and html_body.

    Args:
        template: document returned by get_template (must have "subject"
            and "html_body" string fields).
        tokens: mapping of lowercase token name -> replacement value.
            Values are coerced to str. Missing tokens are left as-is
            (e.g. "{{some_token}}" stays in the output) so gaps are easy
            to spot during testing.

    Returns:
        (rendered_subject, rendered_html_body)
    """
    str_tokens = {k: "" if v is None else str(v) for k, v in tokens.items()}

    def _sub(match: re.Match) -> str:
        key = match.group(1)
        return str_tokens.get(key, match.group(0))

    subject = _TOKEN_RE.sub(_sub, template.get("subject", ""))
    html_body = _TOKEN_RE.sub(_sub, template.get("html_body", ""))
    return subject, html_body
