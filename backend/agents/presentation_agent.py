"""
agents/presentation_agent.py
─────────────────────────────
Specialist agent for generating personalised Terian Services onboarding
presentations.

Chatbot path (via AgentRouter)
──────────────────────────────
    ask(question, history) is overridden — no tool-calling loop.
    Flow:
      1. Single LLM call to extract context JSON from the conversation
      2. generate() dispatches to the correct service-specific method
      3. Returns AskResult with a time-limited SAS download link

Direct path (engagement_worker.py)
────────────────────────────────────
    agent = PresentationAgent()
    result = await agent.generate(job)   # PresentationResult dataclass
    # result.pptx_bytes → attach to Email #2
    # result.blob_path  → stored in CosmosDB
    # result.sas_url    → not used by worker (email attachment used instead)

Dispatch
────────
    generate(job) is the single entry point for both the chatbot and worker
    paths.  It inspects job["engagement_type"] (or "service_id") and routes
    to the appropriate concrete method:

        "Award Nomination"  →  generate_award_onboarding(job)
        <future services>   →  generate_<service>_onboarding(job)

    Concrete methods are responsible for their own template / LLM strategy.
    Adding a new service means adding one method and one branch in generate().

Skills loaded: base, presentation (prompts fetched from Blob; no tools
registered — the loop is not used for this agent).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone

from openai import AzureOpenAI

from agents.ask_agent import AskAgent, AskResult
from agents.skills.presentation.tools import (
    PresentationResult,
    generate_from_template,
    generate_presentation_core,
    generate_summary_presentation,
    generate_services_overview_pptx,
)

logger = logging.getLogger(__name__)

# ── Contract Services tier slug → display name ─────────────────────────────
# Mirrors the kebab-case `slug` values in the Contract Services engagement_details
# document (see scripts/seed_engagement.py). Used to render a human-readable
# {{TIER_NAME}} in the onboarding deck from the stored tier_interest slug.
_CONTRACT_SERVICES_TIER_NAMES: dict[str, str] = {
    "discovery-sprint":      "Paid Discovery Sprint",
    "focused-engagement":    "Focused Engagement",
    "standard-engagement":   "Standard Engagement",
    "enterprise-engagement": "Enterprise Engagement",
}

# ── Context extraction prompt ─────────────────────────────────────────────────
# Used for the single LLM call that reads the conversation and returns the
# prospect context we need before calling generate_presentation_core().

_EXTRACT_SYSTEM = """\
You are a context extractor for the Terian Services presentation agent.
Read the conversation and output ONLY a JSON object with exactly these keys —
no markdown fences, no explanation, just the JSON.

## Classifying presentation_type

Set presentation_type to one of the specific values below ONLY when the user's
request unambiguously names BOTH a product/area AND a deck type.

Examples that ARE specific enough:
  "show me the Award Nomination screen flows"     → "award_screen_flows"
  "integrity sentinel infrastructure deck"        → "integrity_sentinel_infrastructure"
  "services overview presentation"                → "services_overview"
  "give me an IS onboarding presentation"         → "integrity_sentinel_onboarding"

Examples that are NOT specific enough → MUST return "unknown":
  "I'd like to see some presentations"
  "can you show me a presentation?"
  "what presentations do you have?"
  "show me a deck"
  "give me a presentation about Terian"
  Any request that does not name a specific product AND deck type.

When in doubt, use "unknown". It is always better to ask than to generate the wrong deck.

Allowed values:
  "award_onboarding"                  — Award Nomination System onboarding / intro deck
  "award_screen_flows"                — Award Nomination System screen flows / UI walkthrough
  "award_infrastructure"              — Award Nomination System infrastructure / architecture
  "integrity_sentinel_onboarding"     — Integrity Sentinel onboarding / intro deck
  "integrity_sentinel_screen_flows"   — Integrity Sentinel screen flows / UI walkthrough
  "integrity_sentinel_infrastructure" — Integrity Sentinel infrastructure / architecture
  "services_overview"                 — Terian Services overall service catalogue
  "unknown"                           — anything vague, general, or ambiguous

{
  "presentation_type": "<one of the values above>",
  "org_name":          "<company or organisation name, empty string if not mentioned>",
  "full_name":         "<visitor's first and last name if known, empty string otherwise>",
  "industry":          "<industry or sector (e.g. Fintech, Healthcare), empty string if unknown>",
  "user_count":        <integer estimated number of end users, 0 if unknown>,
  "engagement_type":   "<service or product they expressed interest in, empty string if unknown>",
  "tier_interest":     "<Starter|Professional|Enterprise — empty string if not specified>",
  "use_case":          "<one-sentence description of their goal or pain point, empty string if unknown>"
}
"""

_DISAMBIGUATION_MESSAGE = """\
Great — I can generate any of the following presentations for you right now. \
Just tell me which one you'd like and I'll have it ready in seconds.

**Award Nomination System**
- **Onboarding deck** — product overview, key features, how it works, and how to get started
- **Screen flows** — full UI walkthrough from employee submission through approvals to winner announcement
- **Infrastructure overview** — Azure architecture, Cosmos DB, authentication, CI/CD, and security posture

**Integrity Sentinel**
- **Onboarding deck** — product overview, detection capabilities, key differentiators, and pilot offer
- **Screen flows** — alert feed, case investigation, graph explorer, rules configuration, and reporting
- **Infrastructure overview** — ingest pipeline, detection engine layers, Azure deployment, and tenant isolation

**Terian Services**
- **Services overview** — all engineering and analytics capabilities in one concise deck

Which one would you like?
"""

_SAS_EXPIRY_HOURS = 24

# ── Org name normalization ────────────────────────────────────────────────────
# Strip a trailing legal-entity suffix so "Acme Corp, LLC" becomes "Acme"
# rather than "Acme-Corp-Llc" in the deck, slug, and filenames. Applied
# iteratively so multi-part suffixes ("Acme Corp, LLC") are fully removed.
_LEGAL_SUFFIX_RE = re.compile(
    r"[\s,]+(?:incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|"
    r"co|company|plc|llp|lp|gmbh|pte\.?\s*ltd|pty\.?\s*ltd|s\.a|ag|bv|nv)\.?\s*$",
    re.IGNORECASE,
)


def normalize_org_name(org_name: str) -> str:
    """
    Strip trailing legal-entity suffixes (Inc., LLC, Ltd, Corp, ...) from an
    organisation name, repeatedly, so "Acme Corp, LLC" -> "Acme" rather than
    "Acme-Corp-Llc". Falls back to the original (stripped) string if nothing
    is left after stripping, or if no recognisable suffix is present.
    """
    name = (org_name or "").strip()
    while True:
        stripped = _LEGAL_SUFFIX_RE.sub("", name).strip()
        if stripped == name or not stripped:
            break
        name = stripped
    return name or (org_name or "").strip()

# Human-readable labels for each presentation type — used in the reply message.
_PRES_LABELS: dict[str, str] = {
    "award_onboarding":                  "Award Nomination System — Onboarding Deck",
    "award_screen_flows":                "Award Nomination System — Screen Flows",
    "award_infrastructure":              "Award Nomination System — Infrastructure Overview",
    "integrity_sentinel_onboarding":     "Integrity Sentinel — Onboarding Deck",
    "integrity_sentinel_screen_flows":   "Integrity Sentinel — Screen Flows",
    "integrity_sentinel_infrastructure": "Integrity Sentinel — Infrastructure Overview",
    "services_overview":                 "Terian Services — Services Overview",
}


class PresentationAgent(AskAgent):
    """
    Generates personalised onboarding PPTX decks for prospects.

    Chatbot callers use ask(question, history) — overridden here to bypass
    the tool-calling loop entirely.  The engagement worker calls
    generate(job) directly (also bypasses the loop).

    To add a new service:
      1. Add generate_<service>_onboarding(self, job) below.
      2. Add a branch in generate() that routes to it.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        # Skills are loaded for prompt context; no tools are registered
        # (SCHEMAS/IMPLEMENTATIONS removed from presentation/tools.py).
        super().__init__(openai_client=openai_client, skills=["base", "presentation"])

    # ── Chatbot path ──────────────────────────────────────────────────────────

    async def ask(
        self,
        question: str,
        history: list[dict] | None = None,
    ) -> AskResult:
        """
        Override AskAgent.ask() — no tool-calling loop.

        1. Extract context JSON from the conversation (one LLM call).
        2. Call generate_presentation_core() to build + upload the PPTX.
        3. Return AskResult with the SAS download link in the answer.

        Never raises — errors are captured in AskResult.error.
        """
        logger.info(
            "PresentationAgent.ask: %s (history=%d turns)",
            (question or "")[:80],
            len(history) if history else 0,
        )
        try:
            # 1. Extract presentation type + prospect context from the conversation
            context = await asyncio.to_thread(
                self._extract_context, question, history or []
            )
            pres_type = context.get("presentation_type", "unknown")
            logger.info(
                "PresentationAgent: extracted presentation_type=%r org=%r",
                pres_type, context.get("org_name"),
            )

            # 2. Disambiguate if the intent is not clear
            if pres_type == "unknown":
                return AskResult(question=question, answer=_DISAMBIGUATION_MESSAGE)

            # 3. Generate PPTX + upload to Blob (routes through dispatcher)
            result = await self.generate(context)

            # 4. Build a warm, concise response with the download link
            label = _PRES_LABELS.get(pres_type, "presentation")
            org   = context.get("org_name") or ""
            org_clause = f" for **{org}**" if org else ""
            answer = (
                f"Your **{label}**{org_clause} is ready.\n\n"
                f"[Download your presentation]({result.sas_url})"
                f" *(link valid for {_SAS_EXPIRY_HOURS} hours)*\n\n"
                f"Feel free to ask if you'd like a different deck or have any questions."
            )
            return AskResult(question=question, answer=answer)

        except Exception as exc:
            logger.error("PresentationAgent.ask failed: %s", exc, exc_info=True)
            return AskResult(
                question=question,
                answer=(
                    "I wasn't able to generate your presentation right now — "
                    "please try again in a moment, or reach out to "
                    "sales@terian-services.com and we'll prepare one for you directly."
                ),
                error=str(exc),
            )

    def _extract_context(self, question: str, history: list[dict]) -> dict:
        """
        Single synchronous LLM call — run via asyncio.to_thread.

        Sends the conversation (history + new question) with the extraction
        system prompt and parses the JSON response into a context dict.
        Falls back to an empty dict if parsing fails.
        """
        messages: list[dict] = [{"role": "system", "content": _EXTRACT_SYSTEM}]
        for turn in history:
            role = turn.get("role", "")
            if role in ("user", "assistant"):
                messages.append({"role": role, "content": turn.get("content", "")})
        messages.append({"role": "user", "content": question})

        response = self._get_client().chat.completions.create(
            model=self._deployment,
            messages=messages,
            max_completion_tokens=300,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()

        # Strip markdown fences if the model adds them despite instructions
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]

        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError:
            logger.warning(
                "PresentationAgent: could not parse context JSON — using empty context. Raw: %s",
                raw[:200],
            )
            return {}

    # ── Worker / chatbot dispatch path ────────────────────────────────────────

    async def generate(self, job: dict) -> PresentationResult:
        """
        Dispatcher — single entry point for both the worker and chatbot paths.

        Chatbot path: job contains "presentation_type" (set by _extract_context).
        Worker path:  job contains "engagement_type" (legacy key from registration).

        Raises ValueError for unknown types so the worker can dead-letter the job.
        """
        # Chatbot path — explicit presentation_type from context extraction
        pres_type = job.get("presentation_type", "")
        if pres_type:
            dispatch = {
                "award_onboarding":                  self.generate_award_onboarding,
                "award_screen_flows":                self.generate_award_screen_flows,
                "award_infrastructure":              self.generate_award_infrastructure,
                "integrity_sentinel_onboarding":     self.generate_integrity_sentinel_onboarding,
                "integrity_sentinel_screen_flows":   self.generate_integrity_sentinel_screen_flows,
                "integrity_sentinel_infrastructure": self.generate_integrity_sentinel_infrastructure,
                "services_overview":                 self.generate_services_overview,
            }
            handler = dispatch.get(pres_type)
            if handler:
                return await handler(job)
            raise ValueError(f"PresentationAgent: unknown presentation_type {pres_type!r}")

        # Worker / legacy path — route by engagement_type
        raw_type = (job.get("engagement_type") or "").strip().lower().replace("-", " ")
        if raw_type in ("award nomination", "award-nomination", ""):
            return await self.generate_award_onboarding(job)

        if raw_type in ("contract services", "contract-services"):
            return await self.generate_contract_services_onboarding(job)

        raise ValueError(
            f"PresentationAgent: unknown engagement_type {job.get('engagement_type')!r}. "
            "Add a branch in generate() and a concrete method."
        )

    async def generate_award_onboarding(self, job: dict) -> PresentationResult:
        """
        Generate an Award Nomination onboarding presentation using the
        master template stored in blob-templates.

        Template: award_nomination_onboarding.pptx
        Tokens substituted:
          {{CLIENT_NAME}}       — org_name from job payload, full name as typed
          {{CLIENT_SUBDOMAIN}}  — URL-safe slug derived from the trimmed org name
                                   (legal-entity suffixes like Inc./LLC stripped)
          {{PRESENTATION_DATE}} — current month + year (e.g. "May 2026")

        job keys used: org_name, engagement_id (optional).
        All other job keys (tier_interest, full_name, etc.) are available
        for future token expansion without changing the dispatch logic.

        Returns a PresentationResult with pptx_bytes, blob_path, sas_url.
        """
        org_name = (job.get("org_name") or "").strip()

        # Strip trailing legal-entity suffixes (Inc., LLC, Ltd, Corp, ...) before
        # deriving the subdomain slug, so "Acme Corp, LLC" -> "Acme" rather than
        # "Acme-Corp-Llc". CLIENT_NAME keeps the full name as typed — only the
        # slug/subdomain (and downstream filenames) use the trimmed name.
        display_name = normalize_org_name(org_name)

        # Derive a URL-safe subdomain slug: lowercase, spaces/special chars → hyphens
        subdomain = re.sub(r"[^a-z0-9]+", "-", display_name.lower()).strip("-") or "your-company"

        tokens = {
            "CLIENT_NAME":       org_name or "Your Organisation",
            "CLIENT_SUBDOMAIN":  subdomain,
            "PRESENTATION_DATE": datetime.now(timezone.utc).strftime("%B %Y"),
        }

        logger.info(
            "PresentationAgent: generating Award Nomination onboarding "
            "org=%r display_name=%r subdomain=%r",
            org_name, display_name, subdomain,
        )

        return await generate_from_template(
            template_name="award_nomination_onboarding_template.pptx",
            tokens=tokens,
            engagement_id=job.get("engagement_id"),
            company_copy_slug=subdomain,
            presentation_label="award-nomination",
        )

    async def generate_contract_services_onboarding(self, job: dict) -> PresentationResult:
        """
        Generate a Contract Services onboarding presentation using the
        master template stored in blob-templates.

        Template: contract_services_onboarding_template.pptx
        Tokens substituted:
          {{CLIENT_NAME}}       — org_name from job payload, full name as typed
          {{CLIENT_SUBDOMAIN}}  — URL-safe slug derived from the trimmed org name
                                   (legal-entity suffixes like Inc./LLC stripped)
          {{PRESENTATION_DATE}} — current month + year (e.g. "May 2026")
          {{TIER_NAME}}         — selected tier's display name (e.g. "Standard
                                   Engagement"), falling back to the raw
                                   tier_interest value if no display name is known

        job keys used: org_name, tier_interest, engagement_id (optional).

        Returns a PresentationResult with pptx_bytes, blob_path, sas_url.
        """
        org_name = (job.get("org_name") or "").strip()

        # Strip trailing legal-entity suffixes (Inc., LLC, Ltd, Corp, ...) before
        # deriving the subdomain slug, so "Acme Corp, LLC" -> "Acme" rather than
        # "Acme-Corp-Llc". CLIENT_NAME keeps the full name as typed — only the
        # slug/subdomain (and downstream filenames) use the trimmed name.
        display_name = normalize_org_name(org_name)

        # Derive a URL-safe subdomain slug: lowercase, spaces/special chars → hyphens
        subdomain = re.sub(r"[^a-z0-9]+", "-", display_name.lower()).strip("-") or "your-company"

        tier_interest = (job.get("tier_interest") or "").strip()
        tier_name = _CONTRACT_SERVICES_TIER_NAMES.get(tier_interest, tier_interest) or "your selected tier"

        tokens = {
            "CLIENT_NAME":       org_name or "Your Organisation",
            "CLIENT_SUBDOMAIN":  subdomain,
            "PRESENTATION_DATE": datetime.now(timezone.utc).strftime("%B %Y"),
            "TIER_NAME":         tier_name,
        }

        logger.info(
            "PresentationAgent: generating Contract Services onboarding "
            "org=%r display_name=%r subdomain=%r tier=%r",
            org_name, display_name, subdomain, tier_name,
        )

        return await generate_from_template(
            template_name="contract_services_onboarding_template.pptx",
            tokens=tokens,
            engagement_id=job.get("engagement_id"),
            company_copy_slug=subdomain,
            presentation_label="contract-services",
        )

    async def generate_award_screen_flows(self, job: dict) -> PresentationResult:
        """Award Nomination System — screen flows / UI walkthrough presentation."""
        logger.info("PresentationAgent: generating Award Nomination screen flows")
        return await generate_summary_presentation(
            product_id="award-nomination",
            presentation_type="screen_flows",
        )

    async def generate_award_infrastructure(self, job: dict) -> PresentationResult:
        """Award Nomination System — infrastructure / architecture presentation."""
        logger.info("PresentationAgent: generating Award Nomination infrastructure")
        return await generate_summary_presentation(
            product_id="award-nomination",
            presentation_type="infrastructure",
        )

    async def generate_integrity_sentinel_onboarding(self, job: dict) -> PresentationResult:
        """Integrity Sentinel — onboarding / intro deck."""
        logger.info("PresentationAgent: generating Integrity Sentinel onboarding")
        return await generate_summary_presentation(
            product_id="integrity-sentinel",
            presentation_type="onboarding",
        )

    async def generate_integrity_sentinel_screen_flows(self, job: dict) -> PresentationResult:
        """Integrity Sentinel — screen flows / UI walkthrough presentation."""
        logger.info("PresentationAgent: generating Integrity Sentinel screen flows")
        return await generate_summary_presentation(
            product_id="integrity-sentinel",
            presentation_type="screen_flows",
        )

    async def generate_integrity_sentinel_infrastructure(self, job: dict) -> PresentationResult:
        """Integrity Sentinel — infrastructure / architecture presentation."""
        logger.info("PresentationAgent: generating Integrity Sentinel infrastructure")
        return await generate_summary_presentation(
            product_id="integrity-sentinel",
            presentation_type="infrastructure",
        )

    async def generate_services_overview(self, job: dict) -> PresentationResult:
        """Terian Services — full services catalogue overview presentation."""
        logger.info("PresentationAgent: generating services overview")
        return await generate_services_overview_pptx()
