"""
agents/company_info_agent.py
────────────────────────────
Handles general questions about Terian — who we are, the team, services,
pricing, contact, and culture.

Prompt-only: no tool schemas are sent to the LLM, so every request is a
single API call with minimal token overhead.
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent


class CompanyInfoAgent(AskAgent):
    """
    Specialist agent for static company and service FAQ.

    Skills: base, company_info
    Tools:  none — answers come entirely from the system prompt.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "company_info"])
