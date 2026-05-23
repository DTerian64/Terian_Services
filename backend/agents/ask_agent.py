"""
agents/ask_agent.py
───────────────────
Public-site Q&A agent powered by an OpenAI tool-calling loop.

Architecturally identical to the Award_Nomination_App's AskAgent — same
skill-loading pattern, same tool dispatch, same loop shape — minus the
multi-tenant SQL plumbing that this public marketing site doesn't need.

Flow (decided by the LLM at runtime, not by Python):
    ┌─────────────────────────────────────────────────────┐
    │  User question                                      │
    │       │                                             │
    │       ▼                                             │
    │  LLM + TOOLS (loop, ≤ _MAX_ITERATIONS)              │
    │    ├─ call <skill_tool>(...)         → result       │
    │    ├─ ...                                           │
    │    └─ final text answer (no tool call)              │
    │                                                     │
    └─► AskResult  (returned to main.py)                  │

Skill layout — each skill owns its tools (Python stays on disk) while
prompts live in Azure Blob Storage (container: ai-prompts):

    agents/skills/
      base/         (no tools.py — prompt-only skill)
      company_info/ (no tools.py — prompt-only skill)
      web_search/   tools.py  (SCHEMAS + IMPLEMENTATIONS for fetch/search)

    Azure Blob Storage  ai-prompts/<skill>/prompt.md
      base/prompt.md
      company_info/prompt.md
      product/prompt.md
      web_search/prompt.md

Prompts are read from Blob at startup using DefaultAzureCredential
(UAMI via AZURE_CLIENT_ID in ACA; az-cli credential locally via `az login`).
The container app is restarted by the deploy-prompts GitHub Actions workflow
after any prompt update, so every replica picks up the latest content.

Required environment variable:
    AZURE_STORAGE_BLOB_ENDPOINT   e.g. https://stterianservices.blob.core.windows.net/

Adding a new skill: drop a tools.py in agents/skills/<name>/ (optional),
push a prompt.md to ai-prompts/<name>/prompt.md in Blob Storage, and add
the name to _DEFAULT_SKILLS or pass it explicitly. No Python changes needed
for prompt-only skills.

main.py contract:
    from agents import AskAgent, AskResult

    agent  = AskAgent()                # uses _DEFAULT_SKILLS
    result = await agent.ask(question, history=...)
    return {"question": result.question, "answer": result.answer, ...}
"""

from __future__ import annotations

import importlib.util
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, cast

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from openai import AzureOpenAI
from openai.types.chat import (
    ChatCompletionMessage,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from openai.types.chat.chat_completion_message_tool_call import (
    ChatCompletionMessageToolCall,
)

logger = logging.getLogger(__name__)

# Max tool-call iterations per request — prevents runaway loops.
_MAX_ITERATIONS = 8

# Skills directory — one subdirectory per skill (tools.py lives here; prompts are in Blob).
_SKILLS_DIR = Path(__file__).parent / "skills"

# Blob Storage container that holds all skill prompt.md files.
_BLOB_CONTAINER = "ai-prompts"

# Default skill set for the public Ask agent (order matters — base always first).
# Add new skills here as they are created.
_DEFAULT_SKILLS = ["base", "company_info", "product", "web_search"]


# ─────────────────────────────────────────────────────────────────────────────
# Blob prompt loader
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_blob_prompt(skill_name: str) -> str:
    """
    Download <skill_name>/prompt.md from the ai-prompts Blob container.

    Uses DefaultAzureCredential — in ACA this resolves to the UAMI
    (AZURE_CLIENT_ID is already set as a container env var); locally it
    falls through to az-cli / env-var credentials.

    Requires AZURE_STORAGE_BLOB_ENDPOINT to be set (e.g.
    https://stterianservices.blob.core.windows.net/).

    Raises:
        EnvironmentError  — AZURE_STORAGE_BLOB_ENDPOINT is not set
        RuntimeError      — blob download failed (missing blob, auth error, etc.)
    """
    blob_endpoint = os.environ.get("AZURE_STORAGE_BLOB_ENDPOINT", "").rstrip("/")
    if not blob_endpoint:
        raise EnvironmentError(
            "AZURE_STORAGE_BLOB_ENDPOINT is required but not set. "
            "Set it to the storage account's primary blob endpoint "
            "(e.g. https://stterianservices.blob.core.windows.net/)."
        )

    blob_path = f"{skill_name}/prompt.md"
    try:
        credential = DefaultAzureCredential()
        service = BlobServiceClient(account_url=blob_endpoint, credential=credential)
        blob = service.get_blob_client(container=_BLOB_CONTAINER, blob=blob_path)
        content: bytes = blob.download_blob().readall()
        logger.debug("ask_agent: downloaded blob %s/%s (%d bytes)", _BLOB_CONTAINER, blob_path, len(content))
        return content.decode("utf-8")
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load prompt for skill '{skill_name}' "
            f"from {blob_endpoint}/{_BLOB_CONTAINER}/{blob_path}: {exc}"
        ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# Skill loader
# ─────────────────────────────────────────────────────────────────────────────

def _load_skills(
    skill_names: list[str],
) -> tuple[str, list[dict], dict[str, Callable]]:
    """
    Load skills: prompts from Azure Blob Storage, tools from disk.

    For each skill name:
      prompt.md  — downloaded from Blob Storage (ai-prompts/<name>/prompt.md).
                   Fails hard if the blob is unreachable.
      tools.py   — loaded from agents/skills/<name>/tools.py if it exists;
                   silently skipped for prompt-only skills (base, company_info).
                   Must export SCHEMAS (list[dict]) and IMPLEMENTATIONS (dict).

    Returns:
      prompt      — concatenated system prompt (all skills, separated by ---)
      all_schemas — flat list of OpenAI tool schemas from every skill's tools.py
      all_impls   — merged dict mapping tool name → async callable

    Raises:
      EnvironmentError  — AZURE_STORAGE_BLOB_ENDPOINT is not set
      RuntimeError      — a blob download failed
      ValueError        — two skills register the same tool name
    """
    prompt_sections: list[str] = []
    all_schemas: list[dict] = []
    all_impls: dict[str, Callable] = {}

    for name in skill_names:
        # ── Prompt (from Blob Storage — required) ────────────────────────────
        prompt_text = _fetch_blob_prompt(name)
        prompt_sections.append(prompt_text.strip())

        # ── Tools (from disk — optional) ─────────────────────────────────────
        tools_path = _SKILLS_DIR / name / "tools.py"
        if tools_path.exists():
            spec = importlib.util.spec_from_file_location(
                f"agents.skills.{name}.tools", tools_path
            )
            module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
            spec.loader.exec_module(module)                 # type: ignore[union-attr]

            schemas = getattr(module, "SCHEMAS", [])
            impls = getattr(module, "IMPLEMENTATIONS", {})

            if not isinstance(schemas, list):
                raise TypeError(
                    f"Skill '{name}' tools.py: SCHEMAS must be a list, got {type(schemas)}"
                )
            if not isinstance(impls, dict):
                raise TypeError(
                    f"Skill '{name}' tools.py: IMPLEMENTATIONS must be a dict, got {type(impls)}"
                )

            overlap = set(impls) & set(all_impls)
            if overlap:
                raise ValueError(
                    f"Skill '{name}' tools.py defines tool(s) already registered "
                    f"by a previous skill: {sorted(overlap)}"
                )

            all_schemas.extend(schemas)
            all_impls.update(impls)
            logger.debug(
                "ask_agent: skill '%s' registered %d tool(s): %s",
                name, len(impls), list(impls),
            )
        else:
            logger.debug("ask_agent: skill '%s' has no tools.py (prompt-only)", name)

    prompt = "\n\n---\n\n".join(prompt_sections)
    logger.info(
        "ask_agent: loaded %d skill(s) [%s] — %d tools, %d prompt chars",
        len(skill_names), ", ".join(skill_names), len(all_impls), len(prompt),
    )
    return prompt, all_schemas, all_impls


# ─────────────────────────────────────────────────────────────────────────────
# Result dataclass  —  pure data, no HTTP / FastAPI coupling
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ToolCall:
    """Record of a single tool invocation during the agent loop."""
    name: str
    args: dict
    result: dict


@dataclass
class AskResult:
    question: str
    answer: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    error: str | None = None
    intent: str | None = None        # set by AgentRouter after routing; None when agent called directly
    agent_label: str | None = None   # human-readable agent name, set alongside intent


# ─────────────────────────────────────────────────────────────────────────────
# AskAgent
# ─────────────────────────────────────────────────────────────────────────────

class AskAgent:
    """
    Stateless public-site Q&A agent built on an OpenAI tool-calling loop.

    The LLM decides which tools to use — Python just executes them and feeds
    results back into the conversation until the model stops calling tools.

    skills — list of skill names to load from agents/skills/<name>/ directories.
             Each skill directory contains prompt.md (required) and optionally
             tools.py (exporting SCHEMAS and IMPLEMENTATIONS).
             Defaults to _DEFAULT_SKILLS = ["base", "company_info"].
             Pass a subset to create a focused agent with less context.
    """

    def __init__(
        self,
        openai_client: AzureOpenAI | None = None,
        skills: list[str] | None = None,
    ):
        self._client = openai_client
        self._deployment = os.getenv("AZURE_OPENAI_MODEL", "gpt-4.1")

        prompt, schemas, impls = _load_skills(skills or _DEFAULT_SKILLS)
        self._system_prompt: str = prompt
        self._tools: list[dict] = schemas
        self._dispatch: dict[str, Any] = impls

    # ── public entry point ──────────────────────────────────────────────────
    async def ask(
        self,
        question: str,
        history: list[dict] | None = None,
    ) -> AskResult:
        """
        Run the full tool-calling agent loop for a question.

        history — prior conversation turns as a list of
                  {"role": "user"|"assistant", "content": str} dicts.
                  Inserted between the system prompt and the new question
                  so the model has context from earlier turns.  Tool-call
                  messages are NOT included — only the visible
                  user/assistant pairs.  Callers should cap this at
                  ~10 turns (20 messages) before sending.

        Never raises — errors are captured in AskResult.error.
        """
        logger.info(
            "AskAgent.ask: %s (history=%d turns)",
            (question or "")[:80],
            len(history) if history else 0,
        )

        try:
            client = self._get_client()
            messages: list[ChatCompletionMessageParam] = self._build_initial_messages(
                question, history
            )

            tool_calls_log: list[ToolCall] = []

            # ── Tool-calling loop ────────────────────────────────────────────
            for iteration in range(_MAX_ITERATIONS):
                logger.debug("AskAgent: loop iteration %d", iteration + 1)

                # NOTE: `max_completion_tokens` is the forward-compatible
                # parameter name for GPT-4.1-class models and newer.
                # `temperature` is omitted to use the model's default.
                # `tools`, `tool_choice`, and `parallel_tool_calls` are all
                # rejected by the API when no tools are present — omit the
                # entire group together rather than sending tool_choice="none".
                tool_kwargs = (
                    {
                        "tools": self._tools,
                        "tool_choice": "auto",
                        "parallel_tool_calls": False,
                    }
                    if self._tools
                    else {}
                )
                response = client.chat.completions.create(
                    model=self._deployment,
                    messages=messages,
                    **tool_kwargs,
                    max_completion_tokens=1200,
                )

                msg: ChatCompletionMessage = response.choices[0].message

                # Append assistant turn to history
                messages.append(
                    cast(ChatCompletionMessageParam, msg.model_dump(exclude_unset=True))
                )

                # ── No tool calls → final answer ─────────────────────────────
                if not msg.tool_calls:
                    answer = (msg.content or "").strip()
                    if not answer:
                        raise ValueError("LLM returned an empty response")

                    logger.info(
                        "AskAgent: finished in %d iteration(s), %d tool call(s)",
                        iteration + 1, len(tool_calls_log),
                    )
                    return AskResult(
                        question=question,
                        answer=answer,
                        tool_calls=tool_calls_log,
                    )

                # ── Execute each requested tool ──────────────────────────────
                for tc in msg.tool_calls:
                    if not isinstance(tc, ChatCompletionMessageToolCall):
                        logger.warning(
                            "AskAgent: skipping unknown tool call type: %s", type(tc)
                        )
                        continue
                    tool_name = tc.function.name
                    tool_args = json.loads(tc.function.arguments or "{}")

                    logger.info(
                        "AskAgent: tool_call → %s(%s)",
                        tool_name,
                        ", ".join(f"{k}=..." for k in tool_args),
                    )

                    result_json = await self._dispatch_tool(tool_name, tool_args)
                    result_dict = json.loads(result_json)

                    tool_calls_log.append(
                        ToolCall(name=tool_name, args=tool_args, result=result_dict)
                    )

                    # Feed result back into conversation
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_json,
                    })

            # Loop exhausted without a final answer
            logger.warning("AskAgent: hit max iterations (%d)", _MAX_ITERATIONS)
            return AskResult(
                question=question,
                answer=(
                    "I reached the maximum number of tool calls without "
                    "a final answer. Please try a more specific question."
                ),
                tool_calls=tool_calls_log,
                error="max_iterations_exceeded",
            )

        except Exception as e:
            logger.error("AskAgent.ask failed: %s", e, exc_info=True)
            return AskResult(question=question, answer="", error=str(e))

    # ── private helpers ─────────────────────────────────────────────────────

    async def _dispatch_tool(self, tool_name: str, tool_args: dict) -> str:
        """
        Look up tool_name in self._dispatch and call the implementation.

        Always returns a JSON string so the OpenAI conversation loop can
        append it directly as a tool-role message.
        """
        impl = self._dispatch.get(tool_name)
        if impl is None:
            logger.error(
                "AskAgent: unknown tool '%s' — no implementation found", tool_name
            )
            return json.dumps({
                "status": "error",
                "message": f"Unknown tool: {tool_name}",
            })
        try:
            result = await impl(**tool_args)
            return json.dumps(result, default=str)
        except Exception as err:
            logger.error(
                "AskAgent: tool '%s' raised: %s", tool_name, err, exc_info=True
            )
            return json.dumps({"status": "error", "message": str(err)})

    def _get_client(self) -> AzureOpenAI:
        """
        Lazily construct an AzureOpenAI client from env vars.

        Required environment variables:
          AZURE_OPENAI_KEY
          AZURE_OPENAI_ENDPOINT     e.g. https://my-resource.openai.azure.com/
          AZURE_OPENAI_MODEL        deployment name (default: "gpt-4.1")
          AZURE_OPENAI_API_VERSION  default: "2024-12-01-preview"

        Use AzureOpenAI (not the plain OpenAI client) so the SDK constructs
        the correct path: {endpoint}/openai/deployments/{deployment}/...
        """
        if self._client is None:
            self._client = AzureOpenAI(
                api_key=os.getenv("AZURE_OPENAI_KEY", ""),
                azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
            )
            logger.info(
                "AskAgent: AzureOpenAI client initialised (deployment=%s)",
                self._deployment,
            )
        return self._client

    def _build_initial_messages(
        self,
        question: str,
        history: list[dict] | None = None,
    ) -> list[ChatCompletionMessageParam]:
        """
        Construct the full message list for the LLM:
          [system prompt (concatenated skill prompts)]
          [prior user/assistant turns from history]
          [new user question]

        Only user and assistant roles are accepted from history — tool-call
        messages are transient and are never round-tripped through the client.
        """
        messages: list[ChatCompletionMessageParam] = [
            ChatCompletionSystemMessageParam(
                role="system",
                content=self._system_prompt,
            ),
        ]

        for turn in (history or []):
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role == "user":
                messages.append(ChatCompletionUserMessageParam(role="user", content=content))
            elif role == "assistant":
                messages.append(
                    cast(ChatCompletionMessageParam, {"role": "assistant", "content": content})
                )

        messages.append(ChatCompletionUserMessageParam(role="user", content=question))
        return messages
