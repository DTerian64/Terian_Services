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
      2. generate_presentation_core() builds PPTX and uploads to Blob
      3. Returns AskResult with a time-limited SAS download link

Direct path (engagement_worker.py)
────────────────────────────────────
    agent = PresentationAgent()
    result = await agent.generate(job)   # PresentationResult dataclass
    # result.pptx_bytes → attach to Email #2
    # result.blob_path  → stored in CosmosDB
    # result.sas_url    → not used by worker (email attachment used instead)

Skills loaded: base, presentation (prompts fetched from Blob; no tools
registered — the loop is not used for this agent).
"""

from __future__ import annotations

import asyncio
import json
import logging

from openai import AzureOpenAI

from agents.ask_agent import AskAgent, AskResult
from agents.skills.presentation.tools import PresentationResult, generate_presentation_core

logger = logging.getLogger(__name__)

# ── Context extraction prompt ─────────────────────────────────────────────────
# Used for the single LLM call that reads the conversation and returns the
# prospect context we need before calling generate_presentation_core().

_EXTRACT_SYSTEM = """\
You are a context extractor. Read the conversation and output ONLY a JSON object \
with exactly these keys — no markdown fences, no explanation, just the JSON:

{
  "org_name":        "<company or organisation name, empty string if not mentioned>",
  "full_name":       "<visitor's first and last name if known, empty string otherwise>",
  "industry":        "<industry or sector (e.g. Fintech, Healthcare), empty string if unknown>",
  "user_count":      <integer estimated number of end users, 0 if unknown>,
  "engagement_type": "<service or product they expressed interest in, empty string if unknown>",
  "tier_interest":   "<Starter|Professional|Enterprise — empty string if not specified>",
  "use_case":        "<one-sentence description of their goal or pain point, empty string if unknown>"
}
"""

_SAS_EXPIRY_HOURS = 24


class PresentationAgent(AskAgent):
    """
    Generates personalised onboarding PPTX decks for prospects.

    Chatbot callers use ask(question, history) — overridden here to bypass
    the tool-calling loop entirely.  The engagement worker calls
    generate(context) directly (also bypasses the loop).
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
            # 1. Extract prospect context from the conversation
            context = await asyncio.to_thread(
                self._extract_context, question, history or []
            )
            logger.info(
                "PresentationAgent: extracted context org=%r engagement=%r",
                context.get("org_name"), context.get("engagement_type"),
            )

            # 2. Generate PPTX + upload to Blob
            result = await generate_presentation_core(context)

            # 3. Build a warm, concise response with the download link
            org        = context.get("org_name") or "you"
            engagement = context.get("engagement_type") or "your selected service"
            answer = (
                f"Your personalised onboarding deck for **{org}** is ready.\n\n"
                f"[Download your presentation]({result.sas_url})"
                f" *(link valid for {_SAS_EXPIRY_HOURS} hours)*\n\n"
                f"The deck covers who we are, how Terian Services delivers "
                f"**{engagement}**, and what to expect over the next few days. "
                f"Feel free to ask if you have any questions or need a new link."
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

    # ── Worker path ───────────────────────────────────────────────────────────

    async def generate(self, context: dict) -> PresentationResult:
        """
        Direct generation — bypasses the agent loop entirely.

        context should contain: org_name, full_name, industry, user_count,
        engagement_type, tier_interest, use_case, engagement_id (optional).

        Returns a PresentationResult with pptx_bytes, blob_path, sas_url.
        """
        return await generate_presentation_core(context)
