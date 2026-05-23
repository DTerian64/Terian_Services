"""
agents/employees_agent.py
──────────────────────────
Specialist agent for questions about the Terian Services team.

At ask() time the agent fetches the live employee roster from the
`employees` Cosmos DB container, formats it as a plain-text context block,
and prepends it to the user's question before handing off to the standard
AskAgent tool-calling loop.  This keeps the roster current without requiring
a prompt redeploy — add or remove an employee document and the next question
picks up the change automatically.

Flow
────
    question
        │
        ▼
    fetch employees from Cosmos DB  (async, fresh per request)
        │
        ▼
    format roster as context block
        │
        ▼
    enriched_question = context + original question
        │
        ▼
    super().ask(enriched_question, history)   ← standard AskAgent loop
        │
        ▼
    AskResult  (original question restored for logging / persistence)

Cosmos DB document shape (expected fields — all optional except `id`):
    {
        "id":         "<slug or UUID>",
        "name":       "Full Name",
        "title":      "Job title",
        "bio":        "One-paragraph description",
        "expertise":  ["Area 1", "Area 2", ...]   # list or comma-sep string
        "sort_order": 1                            # controls display order
    }

Auth
────
    DefaultAzureCredential — UAMI in ACA (AZURE_CLIENT_ID env var set by
    Terraform), az-cli credential locally.

Environment variables
─────────────────────
    AZURE_COSMOS_ENDPOINT    — Cosmos DB account endpoint URL
    AZURE_COSMOS_DATABASE    — database name (default: "terian-services")
"""

from __future__ import annotations

import logging
import os

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential
from openai import AzureOpenAI

from agents.ask_agent import AskAgent, AskResult

logger = logging.getLogger(__name__)

_CONTAINER_EMPLOYEES = "employees"


# ─────────────────────────────────────────────────────────────────────────────
# Cosmos DB helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_employees() -> list[dict]:
    """
    Return all documents from the employees container.

    Uses a cross-partition query — fine for a small, rarely-changing
    table like an employee roster.  Returns an empty list on any error
    so a transient Cosmos outage degrades gracefully (the agent will
    answer "I don't have current team information" per the skill prompt).
    """
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        logger.warning("EmployeesAgent: AZURE_COSMOS_ENDPOINT not set — skipping roster fetch")
        return []

    try:
        results: list[dict] = []
        async with DefaultAzureCredential() as cred:
            async with CosmosClient(endpoint, credential=cred) as client:
                container = (
                    client
                    .get_database_client(database_name)
                    .get_container_client(_CONTAINER_EMPLOYEES)
                )
                # SELECT * to avoid issues with missing/renamed fields.
                # No partition_key arg → SDK performs a cross-partition
                # query automatically for a single-partition-key container.
                async for doc in container.query_items(
                    query="SELECT * FROM c ORDER BY c.sort_order",
                ):
                    results.append(doc)

        logger.info("EmployeesAgent: fetched %d employee record(s)", len(results))
        return results

    except Exception as exc:
        logger.error("EmployeesAgent: failed to fetch employees: %s", exc, exc_info=True)
        return []


def _format_roster(employees: list[dict]) -> str:
    """
    Format the employee list as a plain-text block for injection into the
    user question.  Each entry uses a consistent key: value layout so the
    LLM can reliably parse names, roles, bios, and expertise areas.
    """
    if not employees:
        return "[No employee records available]"

    lines: list[str] = []
    for emp in employees:
        name = emp.get("name", "").strip()
        if not name:
            continue  # skip malformed documents

        lines.append(f"Name: {name}")

        role = emp.get("title", emp.get("role", "")).strip()
        if role:
            lines.append(f"Role: {role}")

        bio = emp.get("bio", "").strip()
        if bio:
            lines.append(f"Bio: {bio}")

        expertise = emp.get("expertise", [])
        if isinstance(expertise, list):
            expertise_str = ", ".join(str(e) for e in expertise if e)
        else:
            expertise_str = str(expertise).strip()
        if expertise_str:
            lines.append(f"Expertise: {expertise_str}")

        lines.append("---")

    return "\n".join(lines) if lines else "[No employee records available]"


# ─────────────────────────────────────────────────────────────────────────────
# EmployeesAgent
# ─────────────────────────────────────────────────────────────────────────────

class EmployeesAgent(AskAgent):
    """
    Specialist agent for team / roster questions.

    Skills: base, employees
    Tools:  none — answers come from the injected Cosmos DB roster + prompt.

    Overrides ask() to fetch the live employee roster before each call and
    inject it as a context block prepended to the user's question.  This
    ensures the LLM always sees current data without requiring a prompt
    redeploy when the roster changes.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "employees"])

    async def ask(
        self,
        question: str,
        history: list[dict] | None = None,
    ) -> AskResult:
        """
        Fetch employees, build context, enrich the question, delegate to loop.

        The original question is restored on the returned AskResult so
        conversation persistence records what the user actually typed.
        """
        employees = await _fetch_employees()
        roster_block = _format_roster(employees)

        enriched_question = (
            f"[Current Terian Services team roster]\n"
            f"{roster_block}\n\n"
            f"---\n\n"
            f"{question}"
        )

        result = await super().ask(enriched_question, history=history)
        result.question = question  # restore original for logging / persistence
        return result
