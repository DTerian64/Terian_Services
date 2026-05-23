"""
agents/skills/employees/tools.py
──────────────────────────────────
Tool for fetching the live Terian Services employee roster from Cosmos DB.

The LLM calls get_employees() when it needs team information — who works
here, what their roles are, their areas of expertise, and their bios.
Returning the data as a tool result (not injected context) means the LLM
naturally treats it as data it retrieved, so responses read correctly:
"Terian Services currently has..." rather than "from the roster you shared".

Environment variables
─────────────────────
  AZURE_COSMOS_ENDPOINT    — Cosmos DB account endpoint URL
  AZURE_COSMOS_DATABASE    — database name (default: "terian-services")

Auth
────
  DefaultAzureCredential — resolves to UAMI in ACA, az-cli locally.
"""

from __future__ import annotations

import logging
import os

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

_CONTAINER = "employees"


async def get_employees() -> dict:
    """
    Fetch all employee records from the Cosmos DB employees container.

    Returns a dict with keys:
      employees — list of employee dicts (name, title, bio, expertise, ...)
      count     — number of records returned
      status    — "ok" or "error"
      error     — present only on failure
    """
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        logger.warning("employees tool: AZURE_COSMOS_ENDPOINT not set")
        return {
            "status": "error",
            "error": "AZURE_COSMOS_ENDPOINT is not configured.",
            "employees": [],
            "count": 0,
        }

    try:
        results: list[dict] = []
        async with DefaultAzureCredential() as cred:
            async with CosmosClient(endpoint, credential=cred) as client:
                container = (
                    client
                    .get_database_client(database_name)
                    .get_container_client(_CONTAINER)
                )
                async for doc in container.query_items(
                    query="SELECT * FROM c ORDER BY c.sort_order",
                ):
                    # Strip Cosmos DB internal metadata fields before
                    # passing to the LLM — they add noise and token cost.
                    results.append({
                        k: v for k, v in doc.items()
                        if not k.startswith("_")
                    })

        logger.info("employees tool: fetched %d record(s)", len(results))
        return {"status": "ok", "employees": results, "count": len(results)}

    except Exception as exc:
        logger.error("employees tool: failed to fetch: %s", exc, exc_info=True)
        return {
            "status": "error",
            "error": str(exc),
            "employees": [],
            "count": 0,
        }


# ── OpenAI tool schema ────────────────────────────────────────────────────────

SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_employees",
            "description": (
                "Fetch the current Terian Services employee roster from the "
                "internal database. Call this whenever a visitor asks who works "
                "at Terian Services, about a specific team member, about the "
                "founder, or about who to contact for a given topic. "
                "Returns each employee's name, title, bio, and expertise."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]

# ── Dispatch table (consumed by AskAgent._load_skills) ───────────────────────

IMPLEMENTATIONS: dict = {
    "get_employees": get_employees,
}
