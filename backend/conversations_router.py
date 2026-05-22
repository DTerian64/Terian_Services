"""
conversations_router.py
───────────────────────
REST endpoints for Ask AI conversation persistence.

POST /api/conversations
  Create a new conversation for a visitor. Called by the frontend on the
  first message send — title is derived from the opening question.
  Body: { visitor_id, title }
  Returns: ConversationDoc

GET /api/conversations?visitor_id=<uuid>
  List all conversations for a visitor, newest first.
  Returns: list[ConversationSummary]

GET /api/conversations/{conversation_id}/messages?visitor_id=<uuid>
  Load all messages for a conversation in chronological order.
  Returns: list[MessageDoc]

All endpoints are unauthenticated (public marketing site).
visitor_id is a browser-generated UUID stored in localStorage — not a
secret, but we validate it is a valid UUID to guard against injection.
"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

import conversation_service as svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _validate_uuid(value: str, field: str) -> str:
    if not _UUID_RE.match(value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field} must be a valid UUID.",
        )
    return value


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    visitor_id: str = Field(..., min_length=36, max_length=36)
    title: str = Field(default="New conversation", max_length=120)

    @field_validator("visitor_id")
    @classmethod
    def _visitor_uuid(cls, v: str) -> str:
        if not _UUID_RE.match(v):
            raise ValueError("visitor_id must be a valid UUID")
        return v


class ConversationDoc(BaseModel):
    id: str
    visitor_id: str
    title: str
    created_at: str
    updated_at: str


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class MessageDoc(BaseModel):
    id: str
    role: str
    content: str
    intent: str | None = None
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ConversationDoc, status_code=status.HTTP_201_CREATED)
async def create_conversation(body: CreateConversationRequest) -> ConversationDoc:
    """Create a new conversation. Called when the user sends their first message."""
    try:
        doc = await svc.create_conversation(
            visitor_id=body.visitor_id,
            title=body.title,
        )
        return ConversationDoc(**doc)
    except Exception as exc:
        logger.exception("conversations: failed to create conversation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not save conversation. Please try again.",
        )


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    visitor_id: str = Query(..., min_length=36, max_length=36),
) -> list[ConversationSummary]:
    """List all conversations for a visitor, newest first."""
    _validate_uuid(visitor_id, "visitor_id")
    try:
        docs = await svc.list_conversations(visitor_id)
        return [ConversationSummary(**d) for d in docs]
    except Exception as exc:
        logger.exception("conversations: failed to list conversations: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not load conversation history.",
        )


@router.get("/{conversation_id}/messages", response_model=list[MessageDoc])
async def get_messages(
    conversation_id: str,
    visitor_id: str = Query(..., min_length=36, max_length=36),
) -> list[MessageDoc]:
    """Load all messages for a conversation in chronological order."""
    _validate_uuid(conversation_id, "conversation_id")
    _validate_uuid(visitor_id, "visitor_id")
    try:
        docs = await svc.get_messages(conversation_id)
        return [MessageDoc(**d) for d in docs]
    except Exception as exc:
        logger.exception(
            "conversations: failed to load messages for %s: %s", conversation_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not load messages.",
        )
