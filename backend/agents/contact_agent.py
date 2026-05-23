"""
agents/contact_agent.py
────────────────────────
Handles requests to notify Terian Services staff on behalf of a website visitor.

The agent collects the visitor's name, email, and intent, confirms the message
with the visitor, then calls send_notification (defined in skills/contact/tools.py)
which sends an email via Gmail SMTP and persists the record to Cosmos DB.

Skills: base, contact
Tools:  send_notification
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent


class ContactAgent(AskAgent):
    """
    Specialist agent for visitor contact and notification requests.

    The send_notification tool is registered via skills/contact/tools.py.
    The multi-turn confirmation flow (collect → confirm → send) is governed
    entirely by the contact skill prompt.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "contact"])
