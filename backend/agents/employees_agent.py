"""
agents/employees_agent.py
──────────────────────────
Handles questions about the Terian Services team — who works here, individual
bios, areas of expertise, and who to contact for a given topic.

The agent calls the get_employees() tool (defined in skills/employees/tools.py)
to fetch the live roster from Cosmos DB.  Because the data arrives as a tool
result — data the LLM retrieved — responses naturally read as the LLM's own
knowledge ("Terian Services currently has...") rather than as something the
visitor provided.

Skills: base, employees
Tools:  get_employees  (fetches Cosmos DB employees container)
"""

from __future__ import annotations

from openai import AzureOpenAI

from agents.ask_agent import AskAgent


class EmployeesAgent(AskAgent):
    """
    Specialist agent for team and roster questions.

    The get_employees tool is registered via skills/employees/tools.py and
    called by the LLM when needed — no manual context injection required.
    """

    def __init__(self, openai_client: AzureOpenAI | None = None) -> None:
        super().__init__(openai_client=openai_client, skills=["base", "employees"])
