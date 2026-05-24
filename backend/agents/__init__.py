"""
agents/__init__.py
──────────────────
Public interface of the agents package.

ask_ai_router.py imports AgentOrchestrator as the single entry point:

    from agents import AgentOrchestrator, AskResult

Individual agent classes are also exported for testing and direct use:

    from agents import CompanyInfoAgent, ProductAgent, LiveDataAgent
    from agents import ImageProcessorAgent, PDFProcessorAgent, CSVProcessorAgent
    from agents import AgentRouter   # internal; prefer AgentOrchestrator
"""

from .ask_agent import AskAgent, AskResult, ToolCall
from .company_info_agent import CompanyInfoAgent
from .contact_agent import ContactAgent
from .employees_agent import EmployeesAgent
from .legal_agent import LegalAgent
from .live_data_agent import LiveDataAgent
from .product_agent import ProductAgent
from .agent_router import AgentRouter
from .image_processor_agent import ImageProcessorAgent
from .pdf_processor_agent import PDFProcessorAgent
from .csv_processor_agent import CSVProcessorAgent
from .word_processor_agent import WordProcessorAgent
from .agent_orchestrator import AgentOrchestrator

__all__ = [
    "AskAgent",
    "AskResult",
    "ToolCall",
    "CompanyInfoAgent",
    "ContactAgent",
    "EmployeesAgent",
    "LegalAgent",
    "LiveDataAgent",
    "ProductAgent",
    "AgentRouter",
    "ImageProcessorAgent",
    "PDFProcessorAgent",
    "CSVProcessorAgent",
    "WordProcessorAgent",
    "AgentOrchestrator",
]
