"""
agents/skills/legal/tools.py
─────────────────────────────
Tools for the LegalAgent: list and retrieve public PDF download links for
Terian Services contract templates hosted in Azure Blob Storage.

No external API calls — the registry is static Python.  URLs are stable
public blob URLs (container_access_type = "blob" in Terraform).  When a
new template is added:
  1. Add its entry to _TEMPLATES below.
  2. Ensure the corresponding PDF is uploaded to the legal-templates blob
     container (the deploy-legal-templates GHA workflow handles this on push
     to Terian_Services_Legal/main).

BLOB_BASE is derived from AZURE_STORAGE_BLOB_ENDPOINT at import time —
the same env var used by ask_agent.py for prompt loading.
e.g. https://stterianservices.blob.core.windows.net/ → blob base becomes
     https://stterianservices.blob.core.windows.net/legal-templates
"""

from __future__ import annotations

import os

_blob_endpoint = os.environ.get("AZURE_STORAGE_BLOB_ENDPOINT", "").rstrip("/")
_BLOB_BASE = f"{_blob_endpoint}/legal-templates" if _blob_endpoint else ""

_DISCLAIMER = (
    "This template is provided for reference only. "
    "The version executed at time of signing governs the engagement. "
    "For questions or to begin a contract negotiation, contact "
    "sales@terian-services.com."
)

# Registry of all publicly available templates.
# key        — short identifier used as the tool argument
# name       — full document name shown to visitors
# description — one-sentence summary of what the document covers
# suitable_for — when a visitor should use this template
# filename   — blob name in the legal-templates container (no path prefix)
_TEMPLATES: dict[str, dict] = {
    "msa": {
        "key":          "msa",
        "name":         "Master Services Agreement (MSA)",
        "description":  "Umbrella agreement governing all Terian Services client "
                        "engagements — services scope, IP ownership, liability, "
                        "indemnification, and dispute resolution.",
        "suitable_for": "Any services engagement: AI analytics, cloud migration, "
                        "MLOps, integrity & fraud detection.",
        "filename":     "Terian_Services_MSA.pdf",
    },
    "nda": {
        "key":          "nda",
        "name":         "Non-Disclosure Agreement (NDA)",
        "description":  "Mutual confidentiality agreement for exchanging sensitive "
                        "information before or during an engagement.",
        "suitable_for": "Pre-sales conversations, proof-of-concept scoping, and "
                        "due-diligence exchanges.",
        "filename":     "Terian_Services_NDA.pdf",
    },
    "saas": {
        "key":          "saas",
        "name":         "SaaS Subscription Agreement",
        "description":  "Governs access to Terian Services SaaS products — platform "
                        "tiers, billing, acceptable use, and data handling.",
        "suitable_for": "Customers subscribing to the Award Nomination System or any "
                        "future Terian Services SaaS product.",
        "filename":     "Terian_Services_SaaS_Subscription_Agreement.pdf",
    },
}


def _enrich(template: dict) -> dict:
    """Return a copy of the template dict with the download URL and disclaimer added."""
    if not _BLOB_BASE:
        raise EnvironmentError(
            "AZURE_STORAGE_BLOB_ENDPOINT is not set — cannot construct legal template URLs. "
            "Set it to the storage account's primary blob endpoint "
            "(e.g. https://stterianservices.blob.core.windows.net/)."
        )
    return {
        **template,
        "url":        f"{_BLOB_BASE}/{template['filename']}",
        "disclaimer": _DISCLAIMER,
    }


# ── Tool implementations ───────────────────────────────────────────────────────

async def list_legal_templates() -> list[dict]:
    """
    Return a summary list of all available Terian Services contract templates.

    Each item contains:
      key          — short identifier for use with get_legal_template()
      name         — full document name
      description  — one-sentence summary
      suitable_for — guidance on when to use this template
    """
    return [
        {
            "key":          t["key"],
            "name":         t["name"],
            "description":  t["description"],
            "suitable_for": t["suitable_for"],
        }
        for t in _TEMPLATES.values()
    ]


async def get_legal_template(key: str) -> dict:
    """
    Return full details and the PDF download URL for the requested template.

    Args:
        key: Template identifier — one of: "msa", "nda", "saas".

    Returns a dict with:
      key, name, description, suitable_for, url (public PDF link), disclaimer.

    Returns {"error": "..."} if the key is not recognised.
    """
    template = _TEMPLATES.get(key.lower().strip())
    if not template:
        available = ", ".join(f'"{k}"' for k in _TEMPLATES)
        return {
            "error": (
                f"No template found for key '{key}'. "
                f"Available keys: {available}. "
                "Use list_legal_templates() to see all options."
            )
        }
    return _enrich(template)


# ── Tool schemas (OpenAI function-calling format) ─────────────────────────────

SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name":        "list_legal_templates",
            "description": (
                "List all Terian Services contract templates that are available "
                "for visitor download. Returns name, description, and intended use "
                "for each template. Call this when the visitor asks what agreements "
                "or contracts Terian Services has, or which template to start with."
            ),
            "parameters": {
                "type":       "object",
                "properties": {},
                "required":   [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name":        "get_legal_template",
            "description": (
                "Return full details and a PDF download URL for a specific Terian "
                "Services contract template. Call this when the visitor names or "
                "describes a specific document (MSA, NDA, SaaS Subscription Agreement)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type":        "string",
                        "enum":        list(_TEMPLATES.keys()),
                        "description": (
                            'Template identifier. Use "msa" for the Master Services '
                            'Agreement, "nda" for the Non-Disclosure Agreement, '
                            '"saas" for the SaaS Subscription Agreement.'
                        ),
                    },
                },
                "required": ["key"],
            },
        },
    },
]

IMPLEMENTATIONS: dict = {
    "list_legal_templates": list_legal_templates,
    "get_legal_template":   get_legal_template,
}
