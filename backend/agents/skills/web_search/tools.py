"""
agents/skills/web_search/tools.py
───────────────────────────────────
Live web tools for the LiveDataAgent.

Tools
─────
  fetch_webpage(url)          — Fetches any URL via Jina AI Reader and returns
                                clean markdown.  Handles JavaScript-rendered
                                SPAs (React, Vue, etc.) transparently.
                                No API key required.

  search_web(query, num)      — Queries Serper (Google Search) and returns
                                titles, URLs, and snippets for the top results.
                                Requires SERPER_API_KEY env var.

Environment variables
─────────────────────
  SERPER_API_KEY              Serper API key (from Key Vault).
                              Sign up at https://serper.dev to obtain one.
"""

from __future__ import annotations

import logging
import os

import aiohttp

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_JINA_BASE = "https://r.jina.ai/"
_SERPER_ENDPOINT = "https://google.serper.dev/search"
_FETCH_TIMEOUT_S = 30
_SEARCH_TIMEOUT_S = 10
# Truncate fetched page content to keep it within reasonable token budgets.
_MAX_CONTENT_CHARS = 20_000


# ── Tool implementations ──────────────────────────────────────────────────────

async def fetch_webpage(url: str) -> dict:
    """
    Fetch a web page and return its content as clean markdown.

    Uses Jina AI Reader (r.jina.ai) which renders JavaScript before
    extraction — works for React / Vue SPAs as well as static sites.

    Returns a dict with keys:
      url      — the original URL
      content  — page text (markdown), truncated to _MAX_CONTENT_CHARS
      status   — "ok" or "error"
      error    — present only on failure
    """
    jina_url = f"{_JINA_BASE}{url}"
    logger.info("fetch_webpage: fetching %s via Jina", url)

    try:
        timeout = aiohttp.ClientTimeout(total=_FETCH_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                jina_url,
                headers={
                    "Accept": "text/plain",
                    "X-Return-Format": "markdown",
                },
            ) as resp:
                resp.raise_for_status()
                content = await resp.text()

        if len(content) > _MAX_CONTENT_CHARS:
            logger.debug(
                "fetch_webpage: truncating %d chars → %d for %s",
                len(content), _MAX_CONTENT_CHARS, url,
            )
            content = content[:_MAX_CONTENT_CHARS] + "\n\n[Content truncated — page is longer]"

        logger.info("fetch_webpage: got %d chars from %s", len(content), url)
        return {"url": url, "content": content, "status": "ok"}

    except aiohttp.ClientResponseError as exc:
        logger.warning("fetch_webpage: HTTP %d for %s", exc.status, url)
        return {"url": url, "status": "error", "error": f"HTTP {exc.status}: {exc.message}"}
    except Exception as exc:
        logger.error("fetch_webpage: unexpected error for %s: %s", url, exc)
        return {"url": url, "status": "error", "error": str(exc)}


async def search_web(query: str, num_results: int = 5) -> dict:
    """
    Search the web via Serper (Google Search) and return top results.

    Returns a dict with keys:
      query    — the search query
      results  — list of {title, url, snippet} dicts
      status   — "ok" or "error"
      error    — present only on failure
    """
    api_key = os.getenv("SERPER_API_KEY", "")
    if not api_key:
        logger.error("search_web: SERPER_API_KEY is not set")
        return {
            "query": query,
            "status": "error",
            "error": "SERPER_API_KEY environment variable is not configured.",
        }

    num_results = max(1, min(num_results, 10))  # clamp to 1–10
    logger.info("search_web: querying Serper for %r (n=%d)", query, num_results)

    try:
        timeout = aiohttp.ClientTimeout(total=_SEARCH_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                _SERPER_ENDPOINT,
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                json={"q": query, "num": num_results},
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

        results = [
            {
                "title":   r.get("title", ""),
                "url":     r.get("link", ""),
                "snippet": r.get("snippet", ""),
            }
            for r in data.get("organic", [])
        ]

        logger.info("search_web: got %d results for %r", len(results), query)
        return {"query": query, "results": results, "status": "ok"}

    except aiohttp.ClientResponseError as exc:
        logger.warning("search_web: HTTP %d for query %r", exc.status, query)
        return {"query": query, "status": "error", "error": f"HTTP {exc.status}: {exc.message}"}
    except Exception as exc:
        logger.error("search_web: unexpected error for %r: %s", query, exc)
        return {"query": query, "status": "error", "error": str(exc)}


# ── OpenAI tool schemas ───────────────────────────────────────────────────────

SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "fetch_webpage",
            "description": (
                "Fetch the full text content of a web page as clean markdown. "
                "Handles JavaScript-rendered single-page apps (React, Vue, etc.). "
                "Use this when you have a specific URL to read — for example, "
                "a competitor's product page or a known article."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL to fetch, including the scheme (https://).",
                    },
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": (
                "Search the web using Bing and return a ranked list of results "
                "(title, URL, snippet). Use this when you need to find pages about "
                "a topic and don't already have a specific URL. "
                "After searching, call fetch_webpage on the most relevant result "
                "to get full content."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A focused search query — be specific for better results.",
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (1–10). Default is 5.",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    },
]

# ── Dispatch table (consumed by AskAgent._load_skills) ───────────────────────

IMPLEMENTATIONS: dict = {
    "fetch_webpage": fetch_webpage,
    "search_web":    search_web,
}
