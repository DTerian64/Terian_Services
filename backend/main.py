"""
main.py
───────
FastAPI app for the Terian Services public-site backend.

Endpoints
---------
GET  /api/health   — liveness probe (no auth, no LLM call)
POST /api/ask      — public Ask AI Q&A

The Ask endpoint is intentionally unauthenticated — this is the chatbot
that sits on the marketing site.  Cost / abuse protection should be added
via:
  • an Azure Front Door / API Management rate limit in front,
  • or a per-IP throttle middleware before this app goes live.

CORS is locked to the configured TERIAN_ALLOWED_ORIGINS env var (comma-
separated).  Defaults to terian-services.com plus localhost dev origins.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# Load .env early so AZURE_OPENAI_* are available when the agent initialises.
# In production, env vars are injected by the platform and load_dotenv is a no-op.
load_dotenv()

from agents import AskAgent          # noqa: E402  — must come after load_dotenv()
from contact_router import router as contact_router  # noqa: E402
from metrics_router import router as metrics_router  # noqa: E402
from team_router import router as team_router        # noqa: E402

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Terian Services — Public API",
    description="Public-site backend (Ask AI, etc.) for terian-services.com.",
    version="0.1.0",
)


# ── CORS ────────────────────────────────────────────────────────────────────
_default_origins = ",".join([
    "https://terian-services.com",
    "https://www.terian-services.com",
    "http://localhost:5173",  # vite dev server
    "http://localhost:4173",  # vite preview
])
_allowed_origins = [
    o.strip()
    for o in os.getenv("TERIAN_ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.include_router(contact_router)
app.include_router(metrics_router)
app.include_router(team_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,        # public endpoint — no cookies needed
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Agent (single shared instance — stateless across requests) ──────────────
# Constructed lazily so import-time errors (missing prompt.md, etc.) surface
# as 500s on first call rather than crashing the process at boot.
_ask_agent: Optional[AskAgent] = None


def _get_agent() -> AskAgent:
    global _ask_agent
    if _ask_agent is None:
        _ask_agent = AskAgent()
    return _ask_agent


# ── Schemas ─────────────────────────────────────────────────────────────────
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
    error: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health() -> dict:
    """Liveness probe — does not call the LLM."""
    return {"status": "ok"}


@app.post("/api/ask", response_model=AskResponse)
async def ask(body: AskRequest) -> AskResponse:
    """
    Public Ask AI endpoint.

    Stateless — pass the prior conversation in `history` if you want
    multi-turn context.  Returns `error` set when the agent failed to
    produce a usable answer; HTTP status stays 200 in that case so the
    SPA can show the message inline.
    """
    try:
        agent = _get_agent()
    except Exception as exc:  # missing skill files, broken prompt, etc.
        logger.exception("AskAgent failed to initialise: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ask AI is temporarily unavailable. Please try again shortly.",
        )

    history = [t.model_dump() for t in body.history]
    result = await agent.ask(body.question, history=history)

    if result.error and not result.answer:
        # Agent produced no usable answer at all — surface a friendly message
        # but keep the technical detail in `error` for the client to log.
        return AskResponse(
            question=result.question,
            answer="Sorry, I couldn't generate a response right now. Please try again in a moment, or email support@terian-services.com.",
            error=result.error,
        )

    return AskResponse(
        question=result.question,
        answer=result.answer,
        error=result.error,
    )
