"""
agents/product_agent.py
───────────────────────
Handles deep-dive questions about specific Terian products — the Award
Nomination System, ML fraud detection, integrations, and technical
architecture.

Loads the product skill in addition to base + company_info so the LLM has
both general company context and product-specific depth.  Add tools.py to
agents/skills/product/ when product-specific data retrieval is needed
(e.g. querying live demo metrics or feature flags).
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent


class ProductAgent(AskAgent):
    """
    Specialist agent for product-specific Q&A.

    Skills: base, company_info, product
    Tools:  none initially — add agents/skills/product/tools.py to activate.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(
            openai_client=openai_client,
            skills=["base", "company_info", "product"],
        )
