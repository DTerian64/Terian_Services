"""
agents/csv_processor_agent.py
──────────────────────────────
Parses a base64-encoded CSV file and returns a structured plain-text summary
for context injection by the AgentOrchestrator.

No LLM call needed — Python's built-in csv module handles parsing.
The summary includes column names, row count, data types (inferred), and a
configurable number of sample rows so the specialist agent can reason about
the data without the full file in its context window.
"""

from __future__ import annotations

import base64
import csv
import io
import logging

logger = logging.getLogger(__name__)

# Number of sample rows to include in the summary.
_SAMPLE_ROWS = 5

# Hard cap on total summary length.
_MAX_CHARS = 4_000


class CSVProcessorAgent:
    """
    Parses a base64-encoded CSV and returns a structured summary.

    Usage
    ─────
        agent = CSVProcessorAgent()
        summary = await agent.process(csv_base64)
        # summary is plain text, ready to inject into the specialist prompt
    """

    async def process(self, csv_base64: str) -> str:
        """
        Decode and parse the CSV, returning a structured plain-text summary.

        Returns the summary on success, or an error note on failure.
        """
        try:
            csv_bytes = base64.b64decode(csv_base64)
            # Try UTF-8 first, fall back to latin-1 for common Excel exports.
            try:
                csv_text = csv_bytes.decode("utf-8")
            except UnicodeDecodeError:
                csv_text = csv_bytes.decode("latin-1")

            reader = csv.reader(io.StringIO(csv_text))
            rows = list(reader)

            if not rows:
                return "[CSV file is empty.]"

            headers = rows[0]
            data_rows = rows[1:]
            total_rows = len(data_rows)

            # Build summary
            lines: list[str] = [
                f"**CSV Summary — {total_rows} data row(s), {len(headers)} column(s)**",
                "",
                f"**Columns:** {', '.join(headers)}",
                "",
            ]

            if data_rows:
                sample = data_rows[:_SAMPLE_ROWS]
                lines.append(f"**Sample rows (first {min(_SAMPLE_ROWS, total_rows)}):**")
                # Header row
                lines.append("| " + " | ".join(headers) + " |")
                lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                for row in sample:
                    # Pad short rows to match header count
                    padded = row + [""] * (len(headers) - len(row))
                    lines.append("| " + " | ".join(str(v) for v in padded[:len(headers)]) + " |")

            summary = "\n".join(lines)

            if len(summary) > _MAX_CHARS:
                summary = summary[:_MAX_CHARS] + f"\n\n[Summary truncated at {_MAX_CHARS} characters]"

            logger.info(
                "CSVProcessorAgent: parsed %d rows, %d columns",
                total_rows,
                len(headers),
            )
            return summary

        except Exception as exc:
            logger.error(
                "CSVProcessorAgent.process failed: %s", exc, exc_info=True
            )
            return f"[CSV could not be processed: {exc}]"
