"""
attachment_service.py
─────────────────────
Azure Blob Storage helpers for Ask AI file attachment persistence.

Attachments are stored in the `ai-attachments` container under the path:

    {conversation_id}/{timestamp_ms}.{ext}

  conversation_id — the Cosmos DB conversation UUID
  timestamp_ms    — Unix epoch in milliseconds (sortable, guaranteed unique
                    per conversation within human interaction timescales)
  ext             — file extension derived from the MIME type

This gives a natural folder per conversation and chronological ordering
within it, with no coordination needed between replicas.

Auth
  DefaultAzureCredential — resolves to UAMI in ACA (AZURE_CLIENT_ID set),
  az-cli credential locally.

All functions are async.  Failures are logged but not re-raised — a
persistence hiccup must never break the user's chat experience.
"""

from __future__ import annotations

import base64
import logging
import os
import time

from azure.storage.blob.aio import BlobServiceClient
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

_CONTAINER = "ai-attachments"

# MIME type → file extension mapping.
# Keys are lowercase MIME types; the fallback is "bin".
_MIME_TO_EXT: dict[str, str] = {
    # Images
    "image/jpeg":  "jpg",
    "image/png":   "png",
    "image/webp":  "webp",
    "image/gif":   "gif",
    # Documents
    "application/pdf":                                                          "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword":                                                       "doc",
    # Spreadsheets / delimited text
    "text/csv":                                                                 "csv",
    "application/vnd.ms-excel":                                                 "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       "xlsx",
    # Plain text
    "text/plain": "txt",
}


def _ext_for(mime: str) -> str:
    """Return the file extension for a MIME type, defaulting to 'bin'."""
    return _MIME_TO_EXT.get(mime.lower().split(";")[0].strip(), "bin")


async def save_attachment(
    *,
    conversation_id: str,
    file_data: str,
    file_type: str,
) -> str | None:
    """
    Upload a base64-encoded file attachment to Azure Blob Storage.

    Returns the blob path on success, or None on failure.
    Failures are logged but never re-raised.

    blob path format:  {conversation_id}/{timestamp_ms}.{ext}
    """
    endpoint = os.environ.get("AZURE_STORAGE_BLOB_ENDPOINT", "").rstrip("/")
    if not endpoint:
        logger.error("attachment_service: AZURE_STORAGE_BLOB_ENDPOINT is not set — skipping save")
        return None

    ext = _ext_for(file_type)
    timestamp_ms = int(time.time() * 1000)
    blob_path = f"{conversation_id}/{timestamp_ms}.{ext}"

    try:
        file_bytes = base64.b64decode(file_data)

        async with DefaultAzureCredential() as cred:
            async with BlobServiceClient(account_url=endpoint, credential=cred) as service:
                blob_client = service.get_blob_client(
                    container=_CONTAINER, blob=blob_path
                )
                await blob_client.upload_blob(
                    file_bytes,
                    overwrite=True,
                    content_settings=_content_settings(file_type),
                )

        logger.info(
            "attachment_service: saved %d bytes → %s/%s",
            len(file_bytes),
            _CONTAINER,
            blob_path,
        )
        return blob_path

    except Exception as exc:
        logger.error(
            "attachment_service: failed to save attachment for conversation %s: %s",
            conversation_id,
            exc,
            exc_info=True,
        )
        return None


def _content_settings(mime: str):
    """Return a ContentSettings object with the correct content_type."""
    try:
        from azure.storage.blob import ContentSettings  # noqa: PLC0415
        return ContentSettings(content_type=mime)
    except Exception:
        return None
