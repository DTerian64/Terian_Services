"""
agents/skills/presentation/tools.py
────────────────────────────────────
Core PPTX generation capability — shared by PresentationAgent (chatbot path)
and engagement_worker.py (async worker path).

Exported surface
────────────────
  SCHEMAS          — OpenAI tool schema for `generate_presentation` (chatbot)
  IMPLEMENTATIONS  — callable map for the agent loop dispatcher
  generate_presentation_core(context) → PresentationResult
      Direct async function for the worker path — skips JSON serialization.

generate_presentation tool
──────────────────────────
  Input : org_name, industry, user_count, engagement_type, tier_interest, use_case
  Flow  : LLM → slide JSON → python-pptx → Blob upload → SAS URL (24 h)
  Output: {"sas_url": "...", "blob_path": "...", "expires_at": "..."}

Environment variables (all injected by Terraform)
──────────────────────────────────────────────────
  AZURE_STORAGE_BLOB_ENDPOINT   — blob service endpoint
  ENGAGEMENT_ASSETS_CONTAINER   — container name (default: engagement-assets)
  AZURE_OPENAI_KEY / ENDPOINT / MODEL / API_VERSION
"""

from __future__ import annotations

import io
import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from azure.storage.blob import BlobSasPermissions, generate_blob_sas
from azure.storage.blob.aio import BlobServiceClient
from openai import AzureOpenAI
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

_BLOB_ENDPOINT    = os.getenv("AZURE_STORAGE_BLOB_ENDPOINT", "")
_ASSETS_CONTAINER = os.getenv("ENGAGEMENT_ASSETS_CONTAINER", "engagement-assets")
_SAS_EXPIRY_HOURS = 24

# ── Brand palette ──────────────────────────────────────────────────────────────

_TEAL      = RGBColor(0x0D, 0x94, 0x88)
_TEAL_DARK = RGBColor(0x0F, 0x76, 0x6E)
_DARK_BG   = RGBColor(0x0F, 0x0D, 0x18)
_WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
_GRAY_TEXT = RGBColor(0x6B, 0x72, 0x80)
_BODY_TEXT = RGBColor(0x37, 0x41, 0x51)


# ── Result dataclass ───────────────────────────────────────────────────────────

@dataclass
class PresentationResult:
    pptx_bytes: bytes
    blob_path:  str
    sas_url:    str
    expires_at: datetime


# ── Credential helper ──────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


# ── LLM slide content generation ───────────────────────────────────────────────

_SLIDE_PROMPT = """\
You are a professional business writer for Terian Services, a technology consultancy
specialising in AI analytics, data engineering, and cloud solutions.

A prospect has expressed interest. Generate concise, professional slide content for a
6-slide onboarding deck tailored to their context.

Respond ONLY with a valid JSON object matching this exact schema (no markdown fences):
{{
  "slides": [
    {{
      "title": "string — slide heading (max 8 words)",
      "bullets": ["string", "string", "string"]
    }}
  ]
}}

Produce exactly 6 slide objects (indices 0–5):
  0 — Who We Are          (Terian Services overview, 2–3 lines of credibility)
  1 — Our Approach        (how Terian delivers engagements, methodology)
  2 — Your Engagement     (specific to engagement_type and tier, what they get)
  3 — Tailored for {org_name}  (industry fit, use_case alignment, user_count scale)
  4 — What Happens Next   (onboarding timeline: discovery → proposal → kickoff)
  5 — Let's Get Started   (contact info bullets, sales email, website, response time)

Context:
  Organization   : {org_name}
  Industry       : {industry}
  Estimated users: {user_count}
  Engagement type: {engagement_type}
  Tier           : {tier_interest}
  Use case       : {use_case}
"""

_FALLBACK_SLIDES = [ 
    {"title": "Who We Are",        "bullets": ["AI-native technology consultancy", "Deep expertise in data & cloud", "Proven delivery across industries"]},
    {"title": "Our Approach",      "bullets": ["Discovery → Design → Deliver", "Iterative, outcome-focused methodology", "Transparent progress at every stage"]},
    {"title": "Your Engagement",   "bullets": ["Engagement scoped to your needs", "Dedicated team from day one", "Clear milestones and deliverables"]},
    {"title": "Built for You",     "bullets": ["Industry-specific patterns applied", "Scales with your organisation", "Aligned to your use case"]},
    {"title": "What Happens Next", "bullets": ["Discovery call within 2 business days", "Tailored proposal within 1 week", "Kickoff on your timeline"]},
    {"title": "Let's Get Started", "bullets": ["sales@terian-services.com", "terian-services.com", "We respond within one business day"]},
]


def _call_llm_for_slides(context: dict) -> list[dict]:
    """Synchronous LLM call — run via asyncio.to_thread."""
    prompt = _SLIDE_PROMPT.format(
        org_name=context.get("org_name", "your organisation"),
        industry=context.get("industry") or "Technology",
        user_count=f"{context.get('user_count', 0):,}" if isinstance(context.get("user_count"), int) else str(context.get("user_count", "N/A")),
        engagement_type=context.get("engagement_type", ""),
        tier_interest=context.get("tier_interest", ""),
        use_case=context.get("use_case") or "Not specified",
    )
    client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_KEY", ""),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    )
    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4.1"),
        messages=[{"role": "user", "content": prompt}],
        max_completion_tokens=1200,
        temperature=0.4,
    )
    raw = (response.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw)
    slides = data.get("slides", [])
    if len(slides) != 6:
        raise ValueError(f"Expected 6 slides from LLM, got {len(slides)}")
    return slides


# ── PPTX builder ───────────────────────────────────────────────────────────────

def _add_text_box(slide, left, top, width, height, text, font_size, color,
                  bold=False, align=PP_ALIGN.LEFT):
    txb = slide.shapes.add_textbox(left, top, width, height)
    tf = txb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.color.rgb = color
    run.font.bold = bold
    return p


def _build_pptx_bytes(context: dict, slides_content: list[dict]) -> bytes:
    """Build a Terian-branded .pptx deck and return raw bytes. Synchronous."""
    prs = Presentation()
    prs.slide_width  = Inches(10)
    prs.slide_height = Inches(5.625)

    W = prs.slide_width
    H = prs.slide_height
    HEADER_H = Inches(1.1)
    FOOTER_H = Inches(0.45)
    BODY_TOP  = HEADER_H
    MARGIN_L  = Inches(0.55)

    blank = prs.slide_layouts[6]

    # ── Cover slide ────────────────────────────────────────────────────────────
    cover = prs.slides.add_slide(blank)
    cover.background.fill.solid()
    cover.background.fill.fore_color.rgb = _DARK_BG

    accent = cover.shapes.add_shape(1, 0, 0, Inches(0.35), H)
    accent.fill.solid()
    accent.fill.fore_color.rgb = _TEAL
    accent.line.fill.background()

    _add_text_box(cover, MARGIN_L, Inches(0.35), W - Inches(0.7), Inches(0.5),
                  "TERIAN SERVICES", 11, _TEAL, bold=True)

    first_name = (context.get("full_name") or context.get("org_name") or "").split()[0]
    _add_text_box(cover, MARGIN_L, Inches(1.1), W - Inches(0.7), Inches(0.7),
                  f"Welcome, {first_name}" if first_name else "Welcome", 24, _WHITE)

    _add_text_box(cover, MARGIN_L, Inches(1.75), W - Inches(0.7), Inches(1.1),
                  context.get("org_name", ""), 36, _WHITE, bold=True)

    _add_text_box(cover, MARGIN_L, Inches(2.95), W - Inches(0.7), Inches(0.5),
                  "Your Onboarding Overview", 16, _TEAL)

    badge = f"{context.get('engagement_type', '')}  ·  {context.get('tier_interest', '')} Tier"
    _add_text_box(cover, MARGIN_L, Inches(3.6), W - Inches(0.7), Inches(0.4),
                  badge.strip(" · "), 13, _GRAY_TEXT)

    ftr = cover.shapes.add_shape(1, 0, H - FOOTER_H, W, FOOTER_H)
    ftr.fill.solid()
    ftr.fill.fore_color.rgb = RGBColor(0x1A, 0x17, 0x2B)
    ftr.line.fill.background()
    _add_text_box(cover, MARGIN_L, H - FOOTER_H + Pt(4), W - 2 * MARGIN_L, FOOTER_H,
                  "terian-services.com", 10, _GRAY_TEXT)

    # ── Content slides ─────────────────────────────────────────────────────────
    for slide_data in slides_content:
        slide = prs.slides.add_slide(blank)
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = _WHITE

        hdr = slide.shapes.add_shape(1, 0, 0, W, HEADER_H)
        hdr.fill.solid()
        hdr.fill.fore_color.rgb = _TEAL
        hdr.line.fill.background()

        _add_text_box(slide, MARGIN_L, Inches(0.25), W - 2 * MARGIN_L, Inches(0.7),
                      slide_data.get("title", ""), 24, _WHITE, bold=True)

        bullet_top = BODY_TOP + Inches(0.35)
        for bullet in slide_data.get("bullets", [])[:4]:
            _add_text_box(slide, MARGIN_L, bullet_top,
                          Inches(0.25), Inches(0.4), "▸", 13, _TEAL, bold=True)
            _add_text_box(slide, MARGIN_L + Inches(0.3), bullet_top,
                          W - MARGIN_L - Inches(0.6), Inches(0.4),
                          bullet, 16, _BODY_TEXT)
            bullet_top += Inches(0.72)

        ftr2 = slide.shapes.add_shape(1, 0, H - FOOTER_H, W, FOOTER_H)
        ftr2.fill.solid()
        ftr2.fill.fore_color.rgb = _DARK_BG
        ftr2.line.fill.background()
        _add_text_box(slide, MARGIN_L, H - FOOTER_H + Pt(4),
                      W - 2 * MARGIN_L, FOOTER_H,
                      "Terian Services  ·  terian-services.com", 10, _GRAY_TEXT)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


# ── Blob upload + SAS URL ──────────────────────────────────────────────────────

async def _upload_and_sign(blob_path: str, pptx_bytes: bytes) -> tuple[str, datetime]:
    """
    Upload the PPTX to Blob Storage and return (sas_url, expiry).
    Uses a User Delegation SAS so no storage account key is needed —
    the UAMI must have the 'Storage Blob Delegator' role on the account.
    """
    expiry = datetime.now(timezone.utc) + timedelta(hours=_SAS_EXPIRY_HOURS)

    async with _credential() as cred:
        async with BlobServiceClient(account_url=_BLOB_ENDPOINT, credential=cred) as svc:
            # Upload
            blob = svc.get_blob_client(container=_ASSETS_CONTAINER, blob=blob_path)
            await blob.upload_blob(pptx_bytes, overwrite=True)

            # User delegation key for SAS signing
            delegation_key = await svc.get_user_delegation_key(
                key_start_time=datetime.now(timezone.utc),
                key_expiry_time=expiry,
            )

    account_name = urlparse(_BLOB_ENDPOINT).hostname.split(".")[0]
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=_ASSETS_CONTAINER,
        blob_name=blob_path,
        user_delegation_key=delegation_key,
        permission=BlobSasPermissions(read=True),
        expiry=expiry,
    )
    sas_url = f"{_BLOB_ENDPOINT.rstrip('/')}/{_ASSETS_CONTAINER}/{blob_path}?{sas_token}"
    logger.info("presentation: uploaded → %s/%s (SAS valid %dh)", _ASSETS_CONTAINER, blob_path, _SAS_EXPIRY_HOURS)
    return sas_url, expiry


# ── Core generation function (shared entry point) ──────────────────────────────

import asyncio  # noqa: E402 (placed here to keep top-of-file imports clean)


async def generate_presentation_core(context: dict) -> PresentationResult:
    """
    Full generation pipeline — used by both PresentationAgent.generate()
    (worker path) and the LLM tool wrapper (chatbot path).

    context keys (all optional — defaults applied if missing):
      org_name, full_name, industry, user_count,
      engagement_type, tier_interest, use_case
    """
    if not _BLOB_ENDPOINT:
        raise EnvironmentError("AZURE_STORAGE_BLOB_ENDPOINT is not set")

    # 1. LLM → slide content
    try:
        slides_content = await asyncio.to_thread(_call_llm_for_slides, context)
    except Exception as exc:
        logger.warning("presentation: LLM slide generation failed (%s) — using fallback", exc)
        slides_content = _FALLBACK_SLIDES

    # 2. Build PPTX in memory
    pptx_bytes = await asyncio.to_thread(_build_pptx_bytes, context, slides_content)

    # 3. Upload + sign
    blob_path = f"chatbot/{uuid.uuid4()}/onboarding.pptx"
    # Worker overrides blob_path via engagement_id — handled in worker.py
    if context.get("engagement_id"):
        blob_path = f"{context['engagement_id']}/onboarding.pptx"

    sas_url, expiry = await _upload_and_sign(blob_path, pptx_bytes)

    return PresentationResult(
        pptx_bytes=pptx_bytes,
        blob_path=blob_path,
        sas_url=sas_url,
        expires_at=expiry,
    )


# ── OpenAI tool schema + implementation (chatbot path) ────────────────────────

SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "generate_presentation",
            "description": (
                "Generate a personalised Terian Services onboarding presentation (.pptx) "
                "and return a time-limited download link. Call this when the user asks for "
                "a deck, presentation, slides, or onboarding overview. Extract as much "
                "context as possible from the conversation before calling."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "org_name": {
                        "type": "string",
                        "description": "Prospect's organisation or company name.",
                    },
                    "industry": {
                        "type": "string",
                        "description": "Industry or sector (e.g. 'Fintech', 'Healthcare'). Use '' if unknown.",
                    },
                    "user_count": {
                        "type": "integer",
                        "description": "Estimated number of end users. Use 0 if unknown.",
                    },
                    "engagement_type": {
                        "type": "string",
                        "description": "Engagement type the prospect is interested in (e.g. 'Award Nomination System').",
                    },
                    "tier_interest": {
                        "type": "string",
                        "description": "Tier they expressed interest in (e.g. 'Starter', 'Professional', 'Enterprise'). Use '' if unknown.",
                    },
                    "use_case": {
                        "type": "string",
                        "description": "Brief description of their use case or goals. Use '' if unknown.",
                    },
                },
                "required": ["org_name", "engagement_type"],
            },
        },
    }
]


async def _generate_presentation_tool(
    org_name: str,
    engagement_type: str,
    industry: str = "",
    user_count: int = 0,
    tier_interest: str = "",
    use_case: str = "",
) -> dict:
    """Tool implementation — called by the agent loop dispatcher."""
    context = {
        "org_name": org_name,
        "engagement_type": engagement_type,
        "industry": industry,
        "user_count": user_count,
        "tier_interest": tier_interest,
        "use_case": use_case,
    }
    result = await generate_presentation_core(context)
    return {
        "status": "success",
        "sas_url": result.sas_url,
        "blob_path": result.blob_path,
        "expires_at": result.expires_at.isoformat(),
        "message": (
            f"Your personalised presentation is ready. "
            f"[Download your deck]({result.sas_url}) "
            f"(link valid for {_SAS_EXPIRY_HOURS} hours)."
        ),
    }


IMPLEMENTATIONS = {
    "generate_presentation": _generate_presentation_tool,
}
