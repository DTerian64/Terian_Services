"""
conversation_service.py
───────────────────────
CosmosDB read/write helpers for Ask AI conversation persistence.

Two containers in the `terian-services` database:

  ai_conversations   partition key: /visitor_id
    { id, visitor_id, title, created_at, updated_at }

  ai_messages        partition key: /conversation_id
    { id, conversation_id, role, content, intent, export_json, created_at }

Auth
  DefaultAzureCredential — resolves to UAMI in ACA (AZURE_CLIENT_ID set),
  az-cli credential locally.

All functions are async and open a fresh CosmosClient per call (same pattern
as team_router.py — the SDK uses connection pooling internally so this is fine
for a low-traffic marketing site).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

_CONTAINER_CONVERSATIONS = "ai_conversations"
_CONTAINER_MESSAGES = "ai_messages"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_client_and_db(client: CosmosClient) -> Any:
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")
    return client.get_database_client(database_name)


async def _cosmos_context():
    """Async context manager yielding (credential, client, database)."""
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")
    if not endpoint:
        raise EnvironmentError("AZURE_COSMOS_ENDPOINT is not set.")
    return endpoint, database_name


# ─────────────────────────────────────────────────────────────────────────────
# Conversations
# ─────────────────────────────────────────────────────────────────────────────

async def create_conversation(
    visitor_id: str,
    title: str,
    conversation_id: str | None = None,
) -> dict:
    """
    Insert a new conversation document and return it.

    conversation_id — use the caller's UUID when provided (keeps messages and
                      conversation in sync without a round-trip).  A fresh UUID
                      is generated when omitted.
    title           — first 120 chars of the opening user message.
    """
    endpoint, db_name = await _cosmos_context()
    now = _now_iso()
    doc = {
        "id":         conversation_id or str(uuid.uuid4()),
        "visitor_id": visitor_id,
        "title":      title[:120] if title else "New conversation",
        "created_at": now,
        "updated_at": now,
    }
    async with DefaultAzureCredential() as cred:
        async with CosmosClient(endpoint, credential=cred) as client:
            container = client.get_database_client(db_name).get_container_client(
                _CONTAINER_CONVERSATIONS
            )
            await container.create_item(body=doc)
    logger.info("conversation_service: created conversation %s for visitor %s", doc["id"], visitor_id[:8])
    return doc


async def list_conversations(visitor_id: str) -> list[dict]:
    """
    Return all conversations for a visitor, newest first.
    Returns id, title, updated_at — enough for the sidebar.
    """
    endpoint, db_name = await _cosmos_context()
    query = (
        "SELECT c.id, c.title, c.created_at, c.updated_at "
        "FROM c "
        "WHERE c.visitor_id = @visitor_id "
        "ORDER BY c.updated_at DESC"
    )
    params = [{"name": "@visitor_id", "value": visitor_id}]
    results: list[dict] = []
    async with DefaultAzureCredential() as cred:
        async with CosmosClient(endpoint, credential=cred) as client:
            container = client.get_database_client(db_name).get_container_client(
                _CONTAINER_CONVERSATIONS
            )
            async for doc in container.query_items(
                query=query,
                parameters=params,
                partition_key=visitor_id,
            ):
                results.append(doc)
    return results


async def update_conversation(
    conversation_id: str,
    visitor_id: str,
    *,
    title: str | None = None,
) -> None:
    """
    Patch a conversation's updated_at (and optionally title).
    Uses patch_item for an atomic partial update — no read-before-write needed.
    """
    endpoint, db_name = await _cosmos_context()
    ops: list[dict] = [{"op": "set", "path": "/updated_at", "value": _now_iso()}]
    if title is not None:
        ops.append({"op": "set", "path": "/title", "value": title[:120]})

    async with DefaultAzureCredential() as cred:
        async with CosmosClient(endpoint, credential=cred) as client:
            container = client.get_database_client(db_name).get_container_client(
                _CONTAINER_CONVERSATIONS
            )
            await container.patch_item(
                item=conversation_id,
                partition_key=visitor_id,
                patch_operations=ops,
            )


# ─────────────────────────────────────────────────────────────────────────────
# Messages
# ─────────────────────────────────────────────────────────────────────────────

async def get_messages(conversation_id: str) -> list[dict]:
    """
    Return all messages for a conversation in chronological order.
    """
    endpoint, db_name = await _cosmos_context()
    query = (
        "SELECT c.id, c.role, c.content, c.intent, c.created_at "
        "FROM c "
        "WHERE c.conversation_id = @conversation_id "
        "ORDER BY c.created_at ASC"
    )
    params = [{"name": "@conversation_id", "value": conversation_id}]
    results: list[dict] = []
    async with DefaultAzureCredential() as cred:
        async with CosmosClient(endpoint, credential=cred) as client:
            container = client.get_database_client(db_name).get_container_client(
                _CONTAINER_MESSAGES
            )
            async for doc in container.query_items(
                query=query,
                parameters=params,
                partition_key=conversation_id,
            ):
                results.append(doc)
    return results


async def append_messages(
    *,
    conversation_id: str,
    visitor_id: str,
    user_content: str,
    assistant_content: str,
    intent: str | None,
    tool_calls: list | None = None,
) -> None:
    """
    Insert two message documents (user turn + assistant turn) and bump
    the conversation's updated_at in a single Cosmos session.

    tool_calls — serialised as JSON into export_json (mirrors AskMessages.ExportJson).
    Failures are logged but not re-raised — a persistence hiccup must never
    break the user's chat experience.
    """
    endpoint, db_name = await _cosmos_context()
    now = _now_iso()
    export_json = json.dumps(tool_calls) if tool_calls else None

    user_doc = {
        "id":              str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "role":            "user",
        "content":         user_content,
        "intent":          None,
        "export_json":     None,
        "created_at":      now,
    }
    assistant_doc = {
        "id":              str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "role":            "assistant",
        "content":         assistant_content,
        "intent":          intent,
        "export_json":     export_json,
        "created_at":      now,
    }

    try:
        async with DefaultAzureCredential() as cred:
            async with CosmosClient(endpoint, credential=cred) as client:
                db = client.get_database_client(db_name)
                msg_container = db.get_container_client(_CONTAINER_MESSAGES)
                conv_container = db.get_container_client(_CONTAINER_CONVERSATIONS)

                await msg_container.create_item(body=user_doc)
                await msg_container.create_item(body=assistant_doc)
                await conv_container.patch_item(
                    item=conversation_id,
                    partition_key=visitor_id,
                    patch_operations=[
                        {"op": "set", "path": "/updated_at", "value": now}
                    ],
                )
        logger.debug(
            "conversation_service: persisted 2 messages for conversation %s", conversation_id
        )
    except Exception as exc:
        logger.error(
            "conversation_service: failed to persist messages for %s: %s",
            conversation_id, exc, exc_info=True,
        )
