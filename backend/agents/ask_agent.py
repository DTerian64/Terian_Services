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

Skill layout — each skill owns both its prompt context and its tools:

    agents/skills/
      base/         prompt.md            (prompt-only — tone & guardrails)
      company_info/ prompt.md            (prompt-only — company facts)
      <future>/     prompt.md [+ tools.py]

Adding a new skill is just dropping a directory in agents/skills/ with a
prompt.md (required) and an optional tools.py exporting SCHEMAS and
IMPLEMENTATIONS.  This file does not need to change.

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

# Skills directory — one subdirectory per skill.
_SKILLS_DIR = Path(__file__).parent / "skills"

# Default skill set for the public Ask agent (order matters — base always first).
# Add new skills here as they are created.
_DEFAULT_SKILLS = ["base", "company_info"]


# ─────────────────────────────────────────────────────────────────────────────
# Skill loader
# ─────────────────────────────────────────────────────────────────────────────

def _load_skills(
    skill_names: list[str],
) -> tuple[str, list[dict], dict[str, Callable]]:
    """
    Load skills from agents/skills/<name>/ directories.

    Each skill directory may contain:
      prompt.md  — natural-language instructions appended to the system prompt
                   (REQUIRED)
      tools.py   — optional; must export
                     SCHEMAS         (list[dict] of OpenAI tool schemas)
                     IMPLEMENTATIONS (dict[str, async callable])

    Returns:
      prompt      — concatenated system prompt (all skills, separated by ---)
      all_schemas — flat list of OpenAI tool schemas from every skill's tools.py
      all_impls   — merged dict mapping tool name → async callable

    Raises FileNotFoundError if a named skill directory or its prompt.md is
    missing.  A missing tools.py is silently treated as "no tools" so
    prompt-only skills (like company_info) work without a tools file.
    Raises ValueError if two skills register the same tool name.
    """
    prompt_sections: list[str] = []
    all_schemas: list[dict] = []
    all_impls: dict[str, Callable] = {}

    for name in skill_names:
        skill_dir = _SKILLS_DIR / name
        if not skill_dir.is_dir():
            available = (
                [p.name for p in _SKILLS_DIR.iterdir() if p.is_dir()]
                if _SKILLS_DIR.exists() else []
            )
            raise FileNotFoundError(
                f"Skill '{name}' not found at: {skill_dir}\n"
                f"Available skills: {available}"
            )

        # ── Prompt (required) ────────────────────────────────────────────────
        prompt_path = skill_dir / "prompt.md"
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Skill '{name}' is missing prompt.md at: {prompt_path}"
            )
        prompt_sections.append(prompt_path.read_text(encoding="utf-8").strip())

        # ── Tools (optional) ─────────────────────────────────────────────────
        tools_path = skill_dir / "tools.py"
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
                response = client.chat.completions.create(
                    model=self._deployment,
                    messages=messages,
                    tools=self._tools or None,
                    tool_choice="auto" if self._tools else "none",
                    parallel_tool_calls=False,
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
