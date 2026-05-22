"""
agents/agent_orchestrator.py
─────────────────────────────
Top-level coordinator for the Ask AI pipeline.

Responsibilities
────────────────
1. Detect whether the request includes a file attachment.
2. Route the file to the appropriate preprocessor agent to obtain a
   plain-text description / extraction.
3. Enrich the user's question with that context.
4. Delegate the enriched question to AgentRouter for specialist dispatch.
5. Return the AskResult with the original (unmodified) question preserved.

Preprocessor mapping
────────────────────
    image/*                 → ImageProcessorAgent  (vision LLM call)
    application/pdf         → PDFProcessorAgent    (pypdf extraction)
    text/csv
    application/vnd.ms-excel
    text/plain              → CSVProcessorAgent    (csv module parsing)

Any unrecognised MIME type is silently ignored and the question is passed
to the router without enrichment.

The AgentOrchestrator replaces AgentRouter as the entry point called by
ask_ai_router.py.  AgentRouter continues to exist unchanged and is used
internally for specialist dispatch.
"""

from __future__ import annotations

import logging
from typing import Optional

from openai import AzureOpenAI

from agents.agent_router import AgentRouter
from agents.ask_agent import AskResult
from agents.image_processor_agent import ImageProcessorAgent
from agents.pdf_processor_agent import PDFProcessorAgent
from agents.csv_processor_agent import CSVProcessorAgent

logger = logging.getLogger(__name__)

# MIME types handled by each preprocessor
_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_PDF_MIMES   = {"application/pdf"}
_CSV_MIMES   = {"text/csv", "application/vnd.ms-excel", "text/plain"}


class AgentOrchestrator:
    """
    Top-level pipeline coordinator.

    Usage
    ─────
        orchestrator = AgentOrchestrator()
        result = await orchestrator.ask(
            question,
            history=[...],
            file_data="<base64>",   # optional
            file_type="image/png",  # optional MIME type
        )
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        # Shared client passed down to router and image processor.
        self._client = openai_client

        # Lazy-initialised sub-components.
        self._router: Optional[AgentRouter] = None
        self._image_processor: Optional[ImageProcessorAgent] = None

    # ── Public entry point ────────────────────────────────────────────────────

    async def ask(
        self,
        question: str,
        history: list[dict] | None = None,
        file_data: str | None = None,
        file_type: str | None = None,
    ) -> AskResult:
        """
        Orchestrate preprocessing + specialist routing for a single request.

        question  — the user's raw text question.
        history   — prior conversation turns (user/assistant dicts).
        file_data — base64-encoded file content (no data-URI prefix).
        file_type — MIME type of the attached file, e.g. "image/png".

        Never raises — errors from preprocessors are captured as context
        strings; errors from the router are captured in AskResult.error.
        """
        original_question = question
        enriched_question = question

        # ── Step 1: preprocess file if present ───────────────────────────────
        if file_data and file_type:
            mime = file_type.lower().split(";")[0].strip()
            file_context = await self._preprocess(file_data, mime)

            if file_context:
                enriched_question = (
                    f"{question}\n\n"
                    f"[Attached file analysis]\n"
                    f"{file_context}"
                )
                logger.info(
                    "AgentOrchestrator: enriched question with %d chars of file context (mime=%s)",
                    len(file_context),
                    mime,
                )

        # ── Step 2: route to specialist ───────────────────────────────────────
        result = await self._get_router().ask(enriched_question, history=history)

        # Restore original question so conversation history and persistence
        # record what the user actually typed, not the enriched version.
        result.question = original_question
        return result

    # ── File preprocessing ────────────────────────────────────────────────────

    async def _preprocess(self, file_data: str, mime: str) -> str:
        """
        Dispatch file_data to the correct preprocessor based on MIME type.
        Returns plain-text context, or empty string if type is unrecognised.
        """
        if mime in _IMAGE_MIMES:
            logger.info("AgentOrchestrator: preprocessing image (%s)", mime)
            return await self._get_image_processor().process(file_data, mime)

        if mime in _PDF_MIMES:
            logger.info("AgentOrchestrator: preprocessing PDF")
            return await PDFProcessorAgent().process(file_data)

        if mime in _CSV_MIMES:
            logger.info("AgentOrchestrator: preprocessing CSV (%s)", mime)
            return await CSVProcessorAgent().process(file_data)

        logger.warning(
            "AgentOrchestrator: unrecognised MIME type '%s' — skipping preprocessing", mime
        )
        return ""

    # ── Lazy accessors ────────────────────────────────────────────────────────

    def _get_router(self) -> AgentRouter:
        if self._router is None:
            self._router = AgentRouter(openai_client=self._client)
        return self._router

    def _get_image_processor(self) -> ImageProcessorAgent:
        if self._image_processor is None:
            self._image_processor = ImageProcessorAgent(openai_client=self._client)
        return self._image_processor
