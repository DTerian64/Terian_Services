"""
agents/live_data_agent.py
─────────────────────────
Handles questions that require real-time or external information — current
events, live pricing, news, or anything outside Terian's own content.

The web_search skill is prompt-only until agents/skills/web_search/tools.py
is added.  Once that file exports SCHEMAS and IMPLEMENTATIONS, this agent
automatically gains live search capability with no changes here.
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent


class LiveDataAgent(AskAgent):
    """
    Tool-enabled agent for questions needing current or external data.

    Skills: base, web_search
    Tools:  activated by adding agents/skills/web_search/tools.py.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "web_search"])
