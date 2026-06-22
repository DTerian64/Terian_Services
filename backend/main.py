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

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env early so AZURE_OPENAI_* are available when the agent initialises.
# In production, env vars are injected by the platform and load_dotenv is a no-op.
load_dotenv()

from routers.ask_ai_router import router as ask_ai_router                # noqa: E402
from routers.contact_router import router as contact_router              # noqa: E402
from routers.conversations_router import router as conversations_router  # noqa: E402
from routers.engagement_router import router as engagement_router                # noqa: E402
from routers.engagement_intake_router import router as engagement_intake_router  # noqa: E402
from engagement_worker import run_worker                                          # noqa: E402
from routers.introductory_router import router as introductory_router    # noqa: E402
from routers.jobs_router import router as jobs_router                    # noqa: E402
from routers.metrics_router import router as metrics_router                      # noqa: E402
from routers.team_router import router as team_router                    # noqa: E402

# ── Logging ──────────────────────────────────────────────────────────────────

# Any log record whose source file lives inside our backend directory is
# application code — prefix it with "App_Log:" so it can be isolated in
# Azure Monitor / Log Analytics with a simple filter:
#
#   | where Message startswith "App_Log:"
#
# This is path-based, not name-based, so every new module or router added
# to the backend directory is covered automatically — no list to maintain.

_APP_DIR = os.path.dirname(os.path.abspath(__file__))


class _AppLogFilter(logging.Filter):
    """Prepend 'App_Log: ' to messages emitted by our own application code."""

    def filter(self, record: logging.LogRecord) -> bool:
        if os.path.abspath(record.pathname).startswith(_APP_DIR):
            record.msg = f"App_Log: {record.msg}"
        return True


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

# Attach the filter to every handler that basicConfig just created.
for _handler in logging.root.handlers:
    _handler.addFilter(_AppLogFilter())

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────

_REQUIRED_ENV_VARS = [
    "AZURE_COSMOS_ENDPOINT",
    "AZURE_STORAGE_BLOB_ENDPOINT",
    "AZURE_OPENAI_ENDPOINT",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background workers on startup; stop them cleanly on shutdown."""
    # ── Startup env-var check ─────────────────────────────────────────────────
    missing = [v for v in _REQUIRED_ENV_VARS if not os.getenv(v)]
    if missing:
        logger.warning(
            "main: the following required environment variables are not set — "
            "some features will silently degrade: %s",
            ", ".join(missing),
        )

    stop_event = asyncio.Event()
    worker_task = asyncio.create_task(run_worker(stop_event))
    logger.info("main: engagement worker task started")
    try:
        yield
    finally:
        stop_event.set()
        try:
            await asyncio.wait_for(worker_task, timeout=15)
        except asyncio.TimeoutError:
            logger.warning("main: engagement worker did not stop within 15 s — cancelling")
            worker_task.cancel()
        logger.info("main: engagement worker stopped")


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Terian Services — Public API",
    description="Public-site backend (Ask AI, etc.) for terian-services.com.",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(engagement_router)
app.include_router(engagement_intake_router)
app.include_router(introductory_router)
app.include_router(jobs_router)
app.include_router(metrics_router)
app.include_router(team_router)


# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health() -> dict:
    """Liveness probe — does not call the LLM."""
    return {"status": "ok"}
