"""
agents/__init__.py
──────────────────
Public interface of the agents package.

ask_ai_router.py imports AgentRouter as the single entry point:

    from agents import AgentRouter, AskResult

Individual agent classes are also exported for testing and direct use:

    from agents import CompanyInfoAgent, ProductAgent, LiveDataAgent
"""

from .ask_agent import AskAgent, AskResult, ToolCall
from .company_info_agent import CompanyInfoAgent
from .live_data_agent import LiveDataAgent
from .product_agent import ProductAgent
from .agent_router import AgentRouter

__all__ = [
    "AskAgent",
    "AskResult",
    "ToolCall",
    "CompanyInfoAgent",
    "LiveDataAgent",
    "ProductAgent",
    "AgentRouter",
]
