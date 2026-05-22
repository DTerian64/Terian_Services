"""
ask_ai_router.py
────────────────
POST /api/ask — public Ask AI Q&A endpoint.

The endpoint is intentionally unauthenticated — this is the chatbot
that sits on the marketing site.  Cost / abuse protection should be added
via:
  • an Azure Front Door / API Management rate limit in front,
  • or a per-IP throttle middleware before this app goes live.

Pipeline
────────
Every request is handled by AgentOrchestrator, which:

  1. Detects an optional file attachment (image, PDF, CSV).
  2. Routes the file to the appropriate preprocessor agent for a text
     description / extraction.
  3. Enriches the user question with that context.
  4. Passes the enriched question to AgentRouter for specialist dispatch:

       company_info → CompanyInfoAgent   (static FAQ, no tools)
       product      → ProductAgent       (product deep-dives)
       live_data    → LiveDataAgent      (web search + fetch tools)

Stateless — callers pass prior conversation turns in `history` to get
multi-turn context.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from agents import AgentOrchestrator, AskResult  # noqa: F401 (AskResult used for type clarity)
import conversation_service as conv_svc
import attachment_service as attach_svc

logger = logging.getLogger(__name__)

router = APIRouter()


# ── AgentOrchestrator singleton ───────────────────────────────────────────────
# Constructed lazily so import-time errors (missing skill files, bad env vars)
# surface as 503s on first call rather than crashing the process at boot.
_orchestrator: Optional[AgentOrchestrator] = None


def _get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator


# ── Schemas ───────────────────────────────────────────────────────────────────
class HistoryTurn(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., max_length=4000)

    @field_validator("role")
    @classmethod
    def _role_valid(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryTurn] = Field(default_factory=list)
    # Persistence — both optional; if omitted, the exchange is not saved.
    visitor_id: Optional[str] = Field(default=None, max_length=36)
    conversation_id: Optional[str] = Field(default=None, max_length=36)
    # File attachment — both must be present together to be processed.
    # file_data: raw base64-encoded file bytes (no data-URI prefix).
    # file_type: MIME type, e.g. "image/png", "application/pdf", "text/csv".
    file_data: Optional[str] = Field(default=None)
    file_type: Optional[str] = Field(default=None, max_length=100)

    @field_validator("history")
    @classmethod
    def _history_capped(cls, v: list[HistoryTurn]) -> list[HistoryTurn]:
        # Hard cap on history length to bound token cost per request.
        # ~10 turns = 20 messages of up to 4 KB each = ~80 KB max prompt.
        if len(v) > 20:
            raise ValueError("history is too long (max 20 turns)")
        return v


class AskResponse(BaseModel):
    question: str
    answer: str
    intent: Optional[str] = None
    error: Optional[str] = None


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.post("/api/ask", response_model=AskResponse)
async def ask(body: AskRequest) -> AskResponse:
    """
    Public Ask AI endpoint.

    The AgentOrchestrator preprocesses any file attachment, enriches the
    question with extracted context, then delegates to AgentRouter for
    specialist dispatch.  Stateless — pass prior conversation in `history`
    for multi-turn context.  Returns `error` set when the agent failed to
    produce a usable answer; HTTP status stays 200 so the SPA can show it
    inline.
    """
    try:
        orchestrator = _get_orchestrator()
    except Exception as exc:
        logger.exception("AgentOrchestrator failed to initialise: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ask AI is temporarily unavailable. Please try again shortly.",
        )

    history = [t.model_dump() for t in body.history]
    result = await orchestrator.ask(
        body.question,
        history=history,
        file_data=body.file_data,
        file_type=body.file_type,
    )

    logger.info(
        "ask: intent=%s tool_calls=%d error=%s has_file=%s",
        result.intent,
        len(result.tool_calls),
        result.error,
        bool(body.file_data),
    )

    # ── Persist attachment (fire-and-forget) ──────────────────────────────────
    # Save the raw file to Blob Storage before persisting messages so the blob
    # path could be stored alongside the message in a future schema update.
    if body.file_data and body.file_type and body.conversation_id:
        asyncio.ensure_future(
            attach_svc.save_attachment(
                conversation_id=body.conversation_id,
                file_data=body.file_data,
                file_type=body.file_type,
            )
        )

    # ── Persist messages (fire-and-forget) ───────────────────────────────────
    # Only when both visitor_id and conversation_id are provided by the client.
    # Runs as a background task so a Cosmos hiccup never blocks the response.
    if body.visitor_id and body.conversation_id and result.answer:
        tool_calls = (
            [{"name": tc.name, "args": tc.args, "result": tc.result} for tc in result.tool_calls]
            if result.tool_calls else None
        )
        asyncio.ensure_future(
            conv_svc.append_messages(
                conversation_id=body.conversation_id,
                visitor_id=body.visitor_id,
                user_content=body.question,
                assistant_content=result.answer,
                intent=result.intent,
                tool_calls=tool_calls,
            )
        )

    if result.error and not result.answer:
        # Agent produced no usable answer — surface a friendly message but
        # keep the technical detail in `error` for the client to log.
        return AskResponse(
            question=result.question,
            answer="Sorry, I couldn't generate a response right now. Please try again in a moment, or email support@terian-services.com.",
            intent=result.intent,
            error=result.error,
        )

    return AskResponse(
        question=result.question,
        answer=result.answer,
        intent=result.intent,
        error=result.error,
    )
