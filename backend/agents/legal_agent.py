"""
agents/legal_agent.py
──────────────────────
Handles visitor questions about Terian Services contract templates —
MSA, NDA, SaaS Subscription Agreement, and future additions.

The agent uses the list_legal_templates and get_legal_template tools
(defined in skills/legal/tools.py) to return public PDF download links
from the legal-templates blob container.  No clause interpretation,
no commitment to terms — refer those to sales@terian-services.com.

Skills: base, legal
Tools:  list_legal_templates, get_legal_template
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent


class LegalAgent(AskAgent):
    """
    Specialist agent for legal template discovery and download links.

    Template registry and public blob URLs are in skills/legal/tools.py.
    Presentation rules and disclaimer wording are in the legal skill prompt.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "legal"])
