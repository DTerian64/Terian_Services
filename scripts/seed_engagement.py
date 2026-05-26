"""
seed_engagement.py
──────────────────
One-off script to upsert the Award Nomination engagement document into
the CosmosDB engagement_details container.

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
            "user_range": "Up to 50 users",
            "price_monthly": 189,
            "price_annual": 149,
            "highlight": False,
            "cta_label": "Get started",
            "cta_href": "/contact",
        },
        {
            "name": "Professional",
            "user_range": "50–500 users",
            "price_monthly": 624,
            "price_annual": 499,
            "highlight": True,
            "cta_label": "Get started",
            "cta_href": "/contact",
        },
        {
            "name": "Enterprise",
            "user_range": "500+ users",
            "price_monthly": None,
            "price_annual": None,
            "highlight": False,
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


if __name__ == "__main__":
    asyncio.run(seed())
