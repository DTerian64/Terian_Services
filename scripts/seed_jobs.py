"""
seed_jobs.py
─────────────
Upsert the Fractional Grant & Early-Stage Funding Strategist job listing
into the CosmosDB `jobs` container.

Usage
  python scripts/seed_jobs.py

Environment variables (same as the backend)
  AZURE_COSMOS_ENDPOINT     — required
  AZURE_COSMOS_DATABASE     — optional, default: terian-services
  AZURE_CLIENT_ID           — optional; triggers ManagedIdentityCredential
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from dotenv import load_dotenv

load_dotenv()

_COSMOS_ENDPOINT = os.environ["AZURE_COSMOS_ENDPOINT"]
_COSMOS_DATABASE = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_JOBS_CONTAINER  = "jobs"


def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


JOBS: list[dict] = [
    {
        "id": "fractional-grant-strategist",
        "title": "Fractional Grant & Early-Stage Funding Strategist — AI SaaS / Fraud Analytics",
        "tagline": "Help us unlock non-dilutive and impact-aligned capital for Terianix.ai.",
        "location": "Remote",
        "type": "Part-time contractor",
        "status": "open",
        "posted_at": "2026-06-22T00:00:00Z",
        "sections": [
            {
                "heading": "About the Role",
                "body": (
                    "Terian Services is seeking a seasoned grant writer and early-stage funding "
                    "strategist on a fractional basis to identify, pursue, and win non-dilutive "
                    "capital for Terianix.ai — our AI SaaS sub-brand offering the Award Nomination "
                    "System and Integrity Sentinel (AI-powered fraud detection).\n\n"
                    "This is a results-oriented, part-time engagement. You will own the funding "
                    "pipeline end-to-end: opportunity identification, application strategy, "
                    "narrative development, and submission — working closely with the founding team "
                    "to position Terianix's technology and mission for each program."
                ),
                "bullets": [],
            },
            {
                "heading": "Skills Required",
                "body": "Ideal candidates will bring a strong combination of the following:",
                "bullets": [
                    "Proven track record securing SBIR/STTR, NSF, or equivalent federal grants for AI, ML, or cybersecurity technology companies.",
                    "Experience with impact-aligned and mission-driven funding programs (e.g., philanthropic tech funds, economic-justice grant pools).",
                    "Strong technical writing skills — able to translate complex ML/AI concepts (Random Forest, LightGBM, LLM-based pipelines) into clear, compelling narratives for non-technical reviewers.",
                    "Familiarity with SaaS business models and the ability to articulate ARR potential, TAM, and scalability in grant applications.",
                    "Existing relationships or prior success with programs focused on fraud detection, public-sector integrity, or enterprise AI.",
                    "Working knowledge of federal cost-allowability rules (FAR 31.205, 2 CFR 200) as they apply to consultant compensation on federal awards.",
                    "Self-directed with the ability to manage multiple submissions simultaneously and meet hard deadlines without hand-holding.",
                ],
            },
            {
                "heading": "Compensation Structure",
                "body": "This engagement is structured in two phases, with the fee model tailored to each funding source's rules:",
                "bullets": [
                    "Phase 0 (scoping, 2–4 weeks): Flat research fee to identify and prioritize the top 5–10 fundable opportunities across both federal and philanthropic/mission-aligned sources. Paid regardless of outcome.",
                    "Phase 1 — Federal programs (SBIR/STTR, NSF, and similar): Fixed hourly or per-proposal rate, paid by Terian Services directly (not from any awarded federal funds). This reflects federal cost-allowability rules (FAR 31.205-33(f), 2 CFR §200.209), which prohibit contingent or success-based fees on federal grant awards.",
                    "Phase 1 — Philanthropic and mission-aligned programs: Success-fee model — a percentage of awarded funds, rate negotiated based on grant size and program complexity, where the funder's own rules permit it.",
                    "Bonus: Accelerated success-fee rate on any philanthropic/private award exceeding $500K, reflecting the added complexity of large or multi-year programs.",
                ],
            },
            {
                "heading": "Recommended Next Step",
                "body": (
                    "Rather than a traditional cover letter, we ask that interested candidates "
                    "submit a one-page concept brief outlining:\n\n"
                    "1. One to three specific grant programs or funding sources you believe are a "
                    "strong fit for Terianix.ai and why.\n"
                    "2. Your proposed approach and timeline for Phase 0.\n"
                    "3. Your preferred fixed rate for federal-program work and preferred success-fee "
                    "range for philanthropic/private-program work."
                ),
                "bullets": [],
            },
        ],
    }
]


async def seed() -> None:
    async with _credential() as cred:
        async with CosmosClient(_COSMOS_ENDPOINT, credential=cred) as cosmos:
            db = cosmos.get_database_client(_COSMOS_DATABASE)
            container = db.get_container_client(_JOBS_CONTAINER)
            for job in JOBS:
                await container.upsert_item(body=job)
                print(f"  ✓ upserted: {job['id']}")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(seed())
