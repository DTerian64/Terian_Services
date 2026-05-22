"""
agents/image_processor_agent.py
────────────────────────────────
Converts an image into a structured text description for use by downstream
specialist agents.

This is a single-call vision agent — no tool loop, no routing.  The LLM
receives the image and a focused system prompt, and returns a plain-text
description that the AgentOrchestrator appends to the user's question before
passing it to the appropriate specialist.

System prompt is loaded from Azure Blob Storage:
    ai-prompts/image_processor/prompt.md

Supported image formats: anything the Azure OpenAI vision API accepts —
JPEG, PNG, WEBP, GIF (first frame). The caller passes raw base64 and the
MIME type; this agent constructs the data-URI.

Required environment variables (shared with AskAgent):
    AZURE_OPENAI_KEY
    AZURE_OPENAI_ENDPOINT
    AZURE_OPENAI_MODEL        — must be a vision-capable deployment (e.g. gpt-4.1)
    AZURE_OPENAI_API_VERSION
    AZURE_STORAGE_BLOB_ENDPOINT
"""

from __future__ import annotations

import logging
import os

from openai import AzureOpenAI

from agents.ask_agent import _fetch_blob_prompt

logger = logging.getLogger(__name__)

_SKILL_NAME = "image_processor"
_MAX_TOKENS = 1000


class ImageProcessorAgent:
    """
    Converts a base64-encoded image into a structured text description.

    Usage
    ─────
        agent = ImageProcessorAgent()
        description = await agent.process(image_base64, mime_type)
        # description is plain text, ready to inject into the specialist prompt
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        self._client = openai_client
        self._deployment = os.getenv("AZURE_OPENAI_MODEL", "gpt-4.1")
        self._system_prompt: str | None = None   # loaded lazily

    # ── Public entry point ────────────────────────────────────────────────────

    async def process(self, image_base64: str, mime_type: str) -> str:
        """
        Describe the image and return a plain-text structured description.

        image_base64 — raw base64-encoded image bytes (no data-URI prefix).
        mime_type    — MIME type string, e.g. "image/png", "image/jpeg".

        Returns the description on success, or an error note string on failure
        (so the orchestrator can still attempt to answer with partial context).
        """
        try:
            prompt = self._get_system_prompt()
            client = self._get_client()

            data_uri = f"data:{mime_type};base64,{image_base64}"

            response = client.chat.completions.create(
                model=self._deployment,
                messages=[
                    {"role": "system", "content": prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": data_uri, "detail": "high"},
                            },
                            {
                                "type": "text",
                                "text": (
                                    "Please describe this image in detail as instructed. "
                                    "A specialist agent will use your description to "
                                    "answer the user's question."
                                ),
                            },
                        ],
                    },
                ],
                max_completion_tokens=_MAX_TOKENS,
            )

            description = (response.choices[0].message.content or "").strip()
            logger.info(
                "ImageProcessorAgent: described image (%d chars, mime=%s)",
                len(description),
                mime_type,
            )
            return description

        except Exception as exc:
            logger.error(
                "ImageProcessorAgent.process failed: %s", exc, exc_info=True
            )
            return f"[Image could not be processed: {exc}]"

    # ── Private helpers ───────────────────────────────────────────────────────

    def _get_system_prompt(self) -> str:
        if self._system_prompt is None:
            self._system_prompt = _fetch_blob_prompt(_SKILL_NAME)
        return self._system_prompt

    def _get_client(self) -> AzureOpenAI:
        if self._client is None:
            self._client = AzureOpenAI(
                api_key=os.getenv("AZURE_OPENAI_KEY", ""),
                azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
            )
        return self._client
