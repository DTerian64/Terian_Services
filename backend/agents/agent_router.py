"""
agents/agent_router.py
──────────────────────
Intent classifier + agent dispatcher for the public Ask AI endpoint.

Flow
────
    question
        │
        ▼
    classify()          ← cheap gpt-4.1-mini call, ≤ 10 output tokens
        │
        ├─ company_info → CompanyInfoAgent  (base + company_info, no tools)
        ├─ product      → ProductAgent      (base + company_info + product)
        └─ live_data    → LiveDataAgent     (base + web_search, tools optional)
        │
        ▼
    AskResult  (intent field set for logging / debug)

All three specialist agents share a single AzureOpenAI client constructed
lazily on first use.  Each agent is also constructed lazily so a skill-loading
failure (missing prompt.md etc.) surfaces as a 503 on first call rather than
crashing the process at startup.

Environment variables
─────────────────────
  AZURE_OPENAI_CLASSIFY_MODEL   deployment name for the classifier
                                (default: "gpt-4.1-mini")
  AZURE_OPENAI_KEY / ENDPOINT / API_VERSION — shared with all agents
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from openai import AzureOpenAI

from agents.ask_agent import AskResult
from agents.company_info_agent import CompanyInfoAgent
from agents.contact_agent import ContactAgent
from agents.employees_agent import EmployeesAgent
from agents.live_data_agent import LiveDataAgent
from agents.product_agent import ProductAgent

logger = logging.getLogger(__name__)

_VALID_INTENTS = frozenset({"company_info", "contact", "employees", "product", "live_data"})
_DEFAULT_INTENT = "company_info"

# Human-readable agent labels returned to the frontend in AskResponse.agent_label.
# When a new agent is added, add its intent → label here — no frontend changes needed.
_AGENT_LABELS: dict[str, str] = {
    "company_info": "Company Info Agent",
    "product":      "Product Agent",
    "employees":    "Team & People Agent",
    "contact":      "Contact Agent",
    "live_data":    "Web Search Agent",
}

_CLASSIFY_SYSTEM = """\
You are an intent classifier for Terian Services, a B2B software company.
Classify the user question into exactly one of these categories:

company_info  — general questions about Terian Services: who we are, what services
                we offer, pricing, contact details, or culture.
contact       — requests to send a message or notification to Terian Services staff
                on the visitor's behalf: "notify sales", "send a message to support",
                "let the team know", "I want to request a quote", "contact someone".
employees     — questions about the people AND partner firms associated with Terian
                Services: who works here, team members, collaborators, engineering
                partners, the founder, individual or company bios, areas of expertise,
                "who should I talk to about X?", or "does Terian Services have any
                partners / collaborators / contractors?".
product       — specific questions about product features, technical architecture,
                ML capabilities, integrations, demos, or the Award Nomination System.
live_data     — ANY question that asks to fetch, read, summarize, or browse a URL
                or web page (regardless of whose site it is); or questions requiring
                real-time / external information such as current events, live pricing,
                recent news, or competitor comparisons.

When the user provides a URL or asks to "summarize this page", "read this link",
"check the site", or similar — always classify as live_data.

Reply with ONLY the category name. No punctuation, no explanation.\
"""


class AgentRouter:
    """
    Classifies incoming questions and delegates to the right specialist agent.

    Usage
    ─────
        router = AgentRouter()
        result = await router.ask(question, history=[...])
        # result.intent tells you which agent handled it
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        self._classify_model = os.getenv("AZURE_OPENAI_CLASSIFY_MODEL", "gpt-4.1-mini")

        # Shared AzureOpenAI client — passed into every specialist agent so
        # they all reuse the same connection pool.
        self._client: Optional[AzureOpenAI] = openai_client

        # Specialist agents — constructed lazily on first use.
        self._company_info: Optional[CompanyInfoAgent] = None
        self._contact: Optional[ContactAgent] = None
        self._employees: Optional[EmployeesAgent] = None
        self._product: Optional[ProductAgent] = None
        self._live_data: Optional[LiveDataAgent] = None

    # ── Shared client ─────────────────────────────────────────────────────────

    def _get_client(self) -> AzureOpenAI:
        if self._client is None:
            self._client = AzureOpenAI(
                api_key=os.getenv("AZURE_OPENAI_KEY", ""),
                azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
                api_version=os.getenv(
                    "AZURE_OPENAI_API_VERSION", "2024-12-01-preview"
                ),
            )
            logger.info(
                "AgentRouter: AzureOpenAI client initialised (classify_model=%s)",
                self._classify_model,
            )
        return self._client

    # ── Agent accessors (lazy) ────────────────────────────────────────────────

    def _get_company_info(self) -> CompanyInfoAgent:
        if self._company_info is None:
            self._company_info = CompanyInfoAgent(openai_client=self._get_client())
        return self._company_info

    def _get_contact(self) -> ContactAgent:
        if self._contact is None:
            self._contact = ContactAgent(openai_client=self._get_client())
        return self._contact

    def _get_employees(self) -> EmployeesAgent:
        if self._employees is None:
            self._employees = EmployeesAgent(openai_client=self._get_client())
        return self._employees

    def _get_product(self) -> ProductAgent:
        if self._product is None:
            self._product = ProductAgent(openai_client=self._get_client())
        return self._product

    def _get_live_data(self) -> LiveDataAgent:
        if self._live_data is None:
            self._live_data = LiveDataAgent(openai_client=self._get_client())
        return self._live_data

    # ── Classification ────────────────────────────────────────────────────────

    async def classify(self, question: str) -> str:
        """
        Run a cheap LLM call to classify the question intent.

        Returns one of: 'company_info' | 'product' | 'live_data'.
        Falls back to 'company_info' on any error so a classifier outage
        never blocks the user from getting an answer.
        """
        try:
            response = self._get_client().chat.completions.create(
                model=self._classify_model,
                messages=[
                    {"role": "system", "content": _CLASSIFY_SYSTEM},
                    # Cap the question at 500 chars — classifier doesn't need the full text.
                    {"role": "user", "content": question[:500]},
                ],
                max_completion_tokens=10,
            )
            raw = (response.choices[0].message.content or "").strip().lower()
            intent = raw if raw in _VALID_INTENTS else _DEFAULT_INTENT
            if intent != raw:
                logger.warning(
                    "AgentRouter.classify: unexpected label %r — using %s",
                    raw, _DEFAULT_INTENT,
                )
            logger.info(
                "AgentRouter.classify: %r → %s",
                question[:60],
                intent,
            )
            return intent

        except Exception as exc:
            logger.error(
                "AgentRouter.classify: failed (%s) — falling back to %s",
                exc, _DEFAULT_INTENT,
            )
            return _DEFAULT_INTENT

    # ── Main entry point ──────────────────────────────────────────────────────

    async def ask(
        self,
        question: str,
        history: list[dict] | None = None,
    ) -> AskResult:
        """
        Classify the question, select the right specialist agent, and return
        its answer.  The chosen intent is recorded on AskResult.intent.
        """
        intent = await self.classify(question)

        _agent_map = {
            "company_info": self._get_company_info,
            "contact":      self._get_contact,
            "employees":    self._get_employees,
            "product":      self._get_product,
            "live_data":    self._get_live_data,
        }
        agent = _agent_map[intent]()

        result = await agent.ask(question, history=history)
        result.intent = intent
        result.agent_label = _AGENT_LABELS.get(intent)
        return result
