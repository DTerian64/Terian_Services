"""
agents/__init__.py
──────────────────
Public interface of the agents package.  main.py only needs:

    from agents import AskAgent, AskResult

Additional agent classes (orchestrator, summariser, etc.) can be added to
this package later and re-exported here without changing the FastAPI layer.
""" 

from .ask_agent import AskAgent, AskResult, ToolCall

__all__ = ["AskAgent", "AskResult", "ToolCall"]
