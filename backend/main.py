"""
main.py
───────
FastAPI app for the Terian Services public-site backend.

Endpoints
---------
GET  /api/health   — liveness probe (no auth, no LLM call)
POST /api/ask      — public Ask AI Q&A  (see ask_ai_router.py)

CORS is locked to the configured TERIAN_ALLOWED_ORIGINS env var (comma-
separated).  Defaults to terian-services.com plus localhost dev origins.
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env early so AZURE_OPENAI_* are available when the agent initialises.
# In production, env vars are injected by the platform and load_dotenv is a no-op.
load_dotenv()

from ask_ai_router import router as ask_ai_router                # noqa: E402
from contact_router import router as contact_router              # noqa: E402
from conversations_router import router as conversations_router  # noqa: E402
from metrics_router import router as metrics_router              # noqa: E402
from team_router import router as team_router                    # noqa: E402

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Terian Services — Public API",
    description="Public-site backend (Ask AI, etc.) for terian-services.com.",
    version="0.1.0",
)


# ── CORS ─────────────────────────────────────────────────────────────────────
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,        # public endpoint — no cookies needed
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(ask_ai_router)
app.include_router(contact_router)
app.include_router(conversations_router)
app.include_router(metrics_router)
app.include_router(team_router)


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health() -> dict:
    """Liveness probe — does not call the LLM."""
    return {"status": "ok"}
