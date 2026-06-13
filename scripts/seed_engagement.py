"""
seed_engagement.py
──────────────────
One-off script to upsert the engagement documents (Award Nomination,
Contract Services) into the CosmosDB engagement_details container.

Run locally (requires az login or AZURE_COSMOS_KEY env var):

    python seed_engagement.py

Run against a specific endpoint:

    AZURE_COSMOS_ENDPOINT=https://... python seed_engagement.py

The script uses upsert_item so it is safe to re-run — it will overwrite
the existing document with the latest version defined below.
"""

from __future__ import annotations

import asyncio
import json
import os

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from dotenv import load_dotenv
load_dotenv()

_CONTAINER = "engagement_details"

AWARD_NOMINATION_DOC = {
    "id": "award-nomination",
    "service": "Award Nomination",
    "tagline": "Peer recognition with AI-powered integrity analytics",
    "tiers": [
        {
            "name": "Starter",
            "slug": "starter",
            "summary": "Up to 50 users",
            "user_range": "Up to 50 users",
            "description": "Everything a small team needs to run peer nominations with manager approval — up and running in a day.",
            "features": [
                "Peer nominations & manager approval",
                "Basic analytics dashboard",
                "SSO via Google or Microsoft (OAuth)",
                "Employee provisioning via bulk CSV",
                "Manual payroll export",
                "Email support",
            ],
            "price_monthly": 189,
            "price_annual": 149,
            "highlight": False,
            "show_in_pricing": True,
            "cta_label": "Get started",
            "cta_href": "/engagement/new?tier=starter&service=award-nomination&type=Award+Nomination",
        },
        {
            "name": "Professional",
            "slug": "professional",
            "summary": "50–500 users",
            "user_range": "50–500 users",
            "description": "AI-powered integrity analytics and deep integrations for organizations that take recognition seriously.",
            "features": [
                "Everything in Starter",
                "AI integrity analytics — bias & anomaly detection",
                "Custom nomination categories",
                "SSO via SAML (Okta, Azure AD)",
                "Daily automated employee sync",
                "Automatic monthly payroll integration",
                "Audit logs & API access",
                "Priority email + chat support · 99.9% SLA",
            ],
            "price_monthly": 624,
            "price_annual": 499,
            "highlight": True,
            "show_in_pricing": True,
            "cta_label": "Get started",
            "cta_href": "/engagement/new?tier=professional&service=award-nomination&type=Award+Nomination",
        },
        {
            "name": "Enterprise",
            "slug": "enterprise",
            "summary": "500+ users",
            "user_range": "500+ users",
            "description": "Custom pricing, real-time integrations, and a dedicated customer success manager for large organizations.",
            "features": [
                "Everything in Professional",
                "Real-time employee provisioning via API",
                "Real-time payroll integration",
                "HRIS integration",
                "Dedicated customer success manager",
                "99.99% SLA",
                "Custom contract & invoicing",
            ],
            "price_monthly": None,
            "price_annual": None,
            "highlight": False,
            "show_in_pricing": True,
            "cta_label": "Contact sales",
            "cta_href": "/contact",
        },
    ],
    "feature_groups": [
        {
            "name": "Core",
            "features": [
                {"name": "Peer nominations",          "Starter": True,  "Professional": True,  "Enterprise": True},
                {"name": "Manager approval workflow",  "Starter": True,  "Professional": True,  "Enterprise": True},
                {"name": "Basic analytics dashboard",  "Starter": True,  "Professional": True,  "Enterprise": True},
            ],
        },
        {
            "name": "AI & Analytics",
            "features": [
                {"name": "AI integrity analytics",   "Starter": False, "Professional": True,  "Enterprise": True},
                {"name": "Bias & anomaly detection",  "Starter": False, "Professional": True,  "Enterprise": True},
                {"name": "Custom nomination categories", "Starter": False, "Professional": True, "Enterprise": True},
            ],
        },
        {
            "name": "Access & Security",
            "features": [
                {"name": "SSO — OAuth (Google, Microsoft)", "Starter": True,  "Professional": True,  "Enterprise": True},
                {"name": "SSO — SAML (Okta, Azure AD)",     "Starter": False, "Professional": True,  "Enterprise": True},
                {"name": "Audit logs",                       "Starter": False, "Professional": True,  "Enterprise": True},
                {"name": "API access",                       "Starter": False, "Professional": True,  "Enterprise": True},
            ],
        },
        {
            "name": "Integrations",
            "features": [
                {"name": "Employee provisioning", "Starter": "Bulk CSV upload",    "Professional": "Daily automated sync", "Enterprise": "Real-time API"},
                {"name": "Payroll integration",   "Starter": "Manual",             "Professional": "Automatic monthly",    "Enterprise": "Real-time"},
                {"name": "HRIS integration",      "Starter": False,                "Professional": False,                  "Enterprise": True},
            ],
        },
        {
            "name": "Support",
            "features": [
                {"name": "SLA",     "Starter": False,   "Professional": "99.9%",                  "Enterprise": "99.99%"},
                {"name": "Support", "Starter": "Email", "Professional": "Priority email + chat",  "Enterprise": "Dedicated CSM"},
            ],
        },
    ],
    "services_note": (
        "Our professional services engagements are scoped individually. "
        "Typical projects run 8–16 weeks. "
        "Contact us to start a conversation."
    ),
    "notifications": {
        "sending_corporation": "Terianix.ai",
        "corporate_heads_up_email": "award-nomination-corporate-heads-up-email",
        "user_welcome_email": "award-nomination-user-welcome-email",
        "user_presentation_email": "award-nomination-user-presentation-email",
    },
}

CONTRACT_SERVICES_DOC = {
    "id": "contract-services",
    "service": "Contract Services",
    "tagline": "Every engagement starts with a defined outcome — we scope it, build it, and hand off clean.",
    "tiers": [
        {
            "name": "Paid Discovery Sprint",
            "slug": "discovery-sprint",
            "summary": "$5K–$15K · 1–2 weeks",
            "range": "$5K – $15K",
            "duration": "1–2 weeks",
            "description": "A short scoping sprint that produces an architecture sketch, defined scope, timeline, and fixed price for a full engagement. If you move forward, the sprint fee is credited toward the contract.",
            "examples": [
                "Architecture sketch & scope",
                "Fixed-price proposal",
                "Credited toward a full engagement",
            ],
            "highlight": False,
            "show_in_pricing": False,
            "cta_label": "Get started",
            "cta_href": "/engagement/new?tier=discovery-sprint&service=contract-services&type=Contract+Services",
        },
        {
            "name": "Focused Engagement",
            "slug": "focused-engagement",
            "summary": "$15K–$50K · 4–8 weeks",
            "range": "$15K – $50K",
            "duration": "4–8 weeks",
            "description": "A single, well-defined deliverable: a fraud-detection proof of concept, an analytics module, or a cloud migration assessment.",
            "examples": [
                "Anomaly-detection POC",
                "Migration readiness assessment",
                "Dashboard / reporting module",
            ],
            "highlight": False,
            "show_in_pricing": True,
            "cta_label": "Get started",
            "cta_href": "/engagement/new?tier=focused-engagement&service=contract-services&type=Contract+Services",
        },
        {
            "name": "Standard Engagement",
            "slug": "standard-engagement",
            "summary": "$50K–$150K · 8–16 weeks",
            "range": "$50K – $150K",
            "duration": "8–16 weeks",
            "description": "A production-ready system: a full integrity-detection pipeline, a cloud migration phase, or an analytics platform with live data.",
            "examples": [
                "Production fraud-detection pipeline",
                "Datacenter-to-Azure migration phase",
                "End-to-end analytics platform",
            ],
            "highlight": True,
            "show_in_pricing": True,
            "cta_label": "Get started",
            "cta_href": "/engagement/new?tier=standard-engagement&service=contract-services&type=Contract+Services",
        },
        {
            "name": "Enterprise Engagement",
            "slug": "enterprise-engagement",
            "summary": "$150K+ · 3–6 months",
            "range": "$150K+",
            "duration": "3–6 months",
            "description": "Multi-phase builds: org-wide AI/ML rollouts, large-scale cloud migrations, or programs spanning several of our service areas.",
            "examples": [
                "Multi-phase migration program",
                "Org-wide AI/ML platform rollout",
                "Combined analytics + integrity program",
            ],
            "highlight": False,
            "show_in_pricing": True,
            "cta_label": "Get started",
            "cta_href": "/engagement/new?tier=enterprise-engagement&service=contract-services&type=Contract+Services",
        },
    ],
    "payment_steps": [
        {
            "title": "Deposit",
            "detail": "25–30% due at signing. Secures the schedule and covers ramp-up — environment access, data review, and planning.",
        },
        {
            "title": "Milestone payments",
            "detail": "Spread across phase deliverables — architecture sign-off, working prototype, UAT — so payment tracks visible progress.",
        },
        {
            "title": "Final payment",
            "detail": "Due at handoff, once documentation, runbooks, and knowledge transfer are complete.",
        },
    ],
    "discovery_sprint": {
        "title": "Start with a paid discovery sprint.",
        "description": (
            "A 1–2 week scoping sprint ($5K–$15K) gets you a concrete proposal — architecture sketch, scope, "
            "timeline, and fixed price — before you commit to a full engagement. If you move forward, the "
            "sprint fee is credited toward the contract."
        ),
    },
    "services_note": (
        "Every contract is priced as a fixed fee against a defined deliverable — not an open-ended hourly tab. "
        "The ranges above reflect typical scope and duration; your discovery call gets you an exact number."
    ),
    "notifications": {
        "sending_corporation": "Terian Services",
        "corporate_heads_up_email": "contract-services-corporate-heads-up-email",
        "user_welcome_email": "contract-services-user-welcome-email",
        "user_presentation_email": "contract-services-user-presentation-email",
    },
}


async def seed() -> None:
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        raise SystemExit(
            "AZURE_COSMOS_ENDPOINT is not set. "
            "Export it or add it to your .env file."
        )

    print(f"Connecting to {endpoint} …")
    async with DefaultAzureCredential() as credential:
        async with CosmosClient(endpoint, credential=credential) as client:
            container = (
                client
                .get_database_client(database_name)
                .get_container_client(_CONTAINER)
            )
            result = await container.upsert_item(body=AWARD_NOMINATION_DOC)
            print(f"Upserted: id={result['id']}  service={result['service']}")
            print(json.dumps(result, indent=2, default=str))

            result = await container.upsert_item(body=CONTRACT_SERVICES_DOC)
            print(f"Upserted: id={result['id']}  service={result['service']}")
            print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(seed())
