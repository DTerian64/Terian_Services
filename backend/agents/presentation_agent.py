"""
agents/presentation_agent.py
─────────────────────────────
Specialist agent for generating personalised Terian Services onboarding
presentations.

Chatbot path (via AgentRouter)
──────────────────────────────
    PresentationAgent inherits AskAgent's full tool-calling loop.
    The LLM reads the conversation, extracts context, and calls the
    `generate_presentation` tool which builds the PPTX and returns a
    time-limited SAS download link.

Direct path (engagement_worker.py)
────────────────────────────────────
    agent = PresentationAgent()
    result = await agent.generate(job)   # PresentationResult dataclass
    # result.pptx_bytes → attach to Email #2
    # result.blob_path  → stored in CosmosDB
    # result.sas_url    → not used by worker (email attachment used instead)

Skills: base, presentation
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent
from agents.skills.presentation.tools import PresentationResult, generate_presentation_core


class PresentationAgent(AskAgent):
    """
    Generates personalised onboarding PPTX decks for prospects.

    Chatbot callers use the inherited ask(question, history) interface.
    The engagement worker calls generate(context) directly to skip the
    conversational loop and go straight to generation.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "presentation"])

    async def generate(self, context: dict) -> PresentationResult:
        """
        Direct generation — bypasses the agent loop entirely.

        context should contain: org_name, full_name, industry, user_count,
        engagement_type, tier_interest, use_case, engagement_id (optional).

        Returns a PresentationResult with pptx_bytes, blob_path, sas_url.
        """
        return await generate_presentation_core(context)
