"""
agents/pdf_processor_agent.py
──────────────────────────────
Extracts readable text from a base64-encoded PDF and returns it as a plain
string for context injection by the AgentOrchestrator.

No LLM call is made here — pypdf handles extraction entirely in Python.
For very long documents the extracted text is truncated to _MAX_CHARS to
keep downstream prompts within token limits.  A future enhancement can add
an LLM summarisation step for long PDFs.

Dependency: pypdf  (pip install pypdf)
"""

from __future__ import annotations

import base64
import io
import logging

logger = logging.getLogger(__name__)

# Hard cap on extracted text passed to the specialist agent.
# ~8 000 chars ≈ ~2 000 tokens — enough for a dense 4-page document.
_MAX_CHARS = 8_000


class PDFProcessorAgent:
    """
    Extracts text from a base64-encoded PDF.

    Usage
    ─────
        agent = PDFProcessorAgent()
        text = await agent.process(pdf_base64)
        # text is plain extracted content, ready to inject into the specialist prompt
    """

    async def process(self, pdf_base64: str) -> str:
        """
        Decode the base64 PDF and extract all readable text.

        Returns the extracted text on success, or an error note on failure.
        Truncates at _MAX_CHARS with a notice when the document is very long.
        """
        try:
            # Import here so a missing pypdf doesn't break other agents at
            # import time — only raises when a PDF is actually submitted.
            import pypdf  # noqa: PLC0415

            pdf_bytes = base64.b64decode(pdf_base64)
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))

            pages: list[str] = []
            for page in reader.pages:
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(text.strip())

            full_text = "\n\n".join(pages)

            if not full_text.strip():
                return "[PDF contained no extractable text — it may be a scanned image.]"

            truncated = False
            if len(full_text) > _MAX_CHARS:
                full_text = full_text[:_MAX_CHARS]
                truncated = True

            logger.info(
                "PDFProcessorAgent: extracted %d chars from %d page(s)%s",
                len(full_text),
                len(reader.pages),
                " (truncated)" if truncated else "",
            )

            result = f"**Extracted PDF content ({len(reader.pages)} page(s)):**\n\n{full_text}"
            if truncated:
                result += f"\n\n[Document truncated at {_MAX_CHARS} characters]"
            return result

        except ImportError:
            logger.error("PDFProcessorAgent: pypdf is not installed")
            return "[PDF processing is unavailable: pypdf package not installed.]"
        except Exception as exc:
            logger.error(
                "PDFProcessorAgent.process failed: %s", exc, exc_info=True
            )
            return f"[PDF could not be processed: {exc}]"
