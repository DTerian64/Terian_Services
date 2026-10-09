"""Initial Terian data migration. Defaults to inventory; never deletes data."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from tempfile import SpooledTemporaryFile
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from azure.core import MatchConditions
from azure.core.exceptions import ResourceExistsError
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceExistsError
from azure.identity import AzureCliCredential
from azure.storage.blob import BlobServiceClient


@dataclass(frozen=True)
class Environment:
    subscription: str
    tenant: str
    cosmos: str
    storage: str


SOURCE = Environment(
    "4ddf12bb-5397-445f-bcaa-df4c7d3dfdca",
    "4d5f34d3-d97b-40c7-8704-edff856d3654",
    "terian-services-cosmos-db",
    "stterianservices",
)
TARGET = Environment(
    "2bb69129-5e74-44d9-af68-96d45633f667",
    "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9",
    "terianix-services-prod",
    "stterianixservicesprod",
)
DATABASE = "terian-services"
SYSTEM_FIELDS = {"_rid", "_self", "_etag", "_attachments", "_ts"}
MANAGED_BLOBS = {"ai-prompts", "blob-templates"}
OLD_BLOB_URL = re.compile(
    r"https?://stterianservices[.]blob[.]core[.]windows[.]net[^\s\"<>\]\)]*",
    re.IGNORECASE,
)


def emit(event: str, **fields: Any) -> None:
    print(json.dumps({"event": event, **fields}, sort_keys=True), flush=True)


def clean_document(document: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in document.items() if key not in SYSTEM_FIELDS}


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def prepare_document(document: dict[str, Any]) -> tuple[dict[str, Any], int, int]:
    """Rewrite unsigned blob URLs; retain historical SAS URLs as historical text."""
    payload = clean_document(document)
    if isinstance(payload.get("ttl"), (int, float)) and payload["ttl"] > 0:
        raise ValueError("A document has an expiring TTL; expiry-aware migration is required.")
    rewritten = 0
    signed = 0

    def replace_url(match: re.Match[str]) -> str:
        nonlocal rewritten, signed
        url = match.group()
        if "sig=" in urlsplit(url).query.lower():
            signed += 1
            return url
        rewritten += 1
        return re.sub(
            re.escape(SOURCE.storage) + r"(?=[.]blob[.]core[.]windows[.]net)",
            TARGET.storage, url, count=1, flags=re.IGNORECASE,
        )

    def walk(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: walk(item) for key, item in value.items()}
        if isinstance(value, list):
            return [walk(item) for item in value]
        return OLD_BLOB_URL.sub(replace_url, value) if isinstance(value, str) else value

    return walk(payload), rewritten, signed


def document_key(document: dict[str, Any], paths: list[str]) -> tuple[str, str]:
    values = []
    for path in paths:
        value: Any = document
        for segment in path.lstrip("/").split("/"):
            key = segment.replace("~1", "/").replace("~0", "~")
            if not isinstance(value, dict) or key not in value:
                raise ValueError("A document has an undefined partition key; explicit handling is required.")
            value = value[key]
        values.append(value)
    return str(document["id"]), canonical(values)


def blob_hash(client: Any, etag: str) -> str:
    digest = hashlib.sha256()
    for chunk in client.download_blob(
        etag=etag, match_condition=MatchConditions.IfNotModified
    ).chunks():
        digest.update(chunk)
    return digest.hexdigest()


def blob_headers(properties: Any) -> tuple[Any, ...]:
    settings = properties.content_settings
    return (
        properties.metadata or {},
        settings.content_type, settings.content_encoding, settings.content_language,
        settings.content_disposition, settings.cache_control,
    )


def seed_documents(filename: str, names: list[str]) -> list[dict[str, Any]]:
    """Read literal seed definitions without importing scripts or loading .env."""
    tree = ast.parse(Path(__file__).with_name(filename).read_text(encoding="utf-8-sig"))
    definitions = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            name = node.targets[0]
        elif isinstance(node, ast.AnnAssign):
            name = node.target
        else:
            continue
        if not isinstance(name, ast.Name):
            continue
        try:
            definitions[name.id] = ast.literal_eval(node.value)
        except (ValueError, TypeError):
            if isinstance(node.value, ast.List) and all(
                isinstance(item, ast.Name) and item.id in definitions for item in node.value.elts
            ):
                definitions[name.id] = [definitions[item.id] for item in node.value.elts]
    result = []
    for name in names:
        value = definitions[name]
        result.extend(value if isinstance(value, list) else [value])
    return result


def compare_seeds() -> int:
    definitions = (
        ("email_templates", "seed_email_templates.py", ["TEMPLATES"]),
        ("jobs", "seed_jobs.py", ["JOBS"]),
        ("engagement_details", "seed_engagement.py", ["AWARD_NOMINATION_DOC", "CONTRACT_SERVICES_DOC"]),
    )
    credential = AzureCliCredential(subscription=SOURCE.subscription, process_timeout=60)
    try:
        with CosmosClient(
            f"https://{SOURCE.cosmos}.documents.azure.com:443/", credential=credential,
        ) as client:
            database = client.get_database_client(DATABASE)
            for name, filename, names in definitions:
                seeds = seed_documents(filename, names)
                source = database.get_container_client(name)
                paths = source.read()["partitionKey"]["paths"]
                original = {
                    document_key(item, paths): clean_document(item)
                    for item in source.read_all_items()
                }
                indexed_seeds = {document_key(item, paths): item for item in seeds}
                common = set(original) & set(indexed_seeds)
                differences = [
                    {
                        "id": key[0],
                        "changed_fields": sorted(
                            field for field in set(original[key]) | set(indexed_seeds[key])
                            if original[key].get(field) != indexed_seeds[key].get(field)
                        ),
                    }
                    for key in sorted(common)
                    if canonical(original[key]) != canonical(indexed_seeds[key])
                ]
                emit(
                    "seed-comparison", container=name, script=filename,
                    source_count=len(original), seed_count=len(seeds),
                    identical=sum(canonical(original[key]) == canonical(indexed_seeds[key])
                                  for key in common),
                    changed=differences,
                    source_only_ids=sorted(key[0] for key in set(original) - set(indexed_seeds)),
                    seed_only_ids=sorted(key[0] for key in set(indexed_seeds) - set(original)),
                )
        return 0
    finally:
        credential.close()


class Migration:
    def __init__(self) -> None:
        self.clients: list[Any] = []
        self.databases = []
        self.storage = []
        for environment in (SOURCE, TARGET):
            # Azure CLI forbids supplying tenant and subscription together.
            # A subscription selects its cached account and owning tenant.
            credential = AzureCliCredential(
                subscription=environment.subscription,
                process_timeout=60,
            )
            cosmos = CosmosClient(
                f"https://{environment.cosmos}.documents.azure.com:443/",
                credential=credential,
            )
            storage = BlobServiceClient(
                f"https://{environment.storage}.blob.core.windows.net/",
                credential=credential,
            )
            self.clients.extend([credential, cosmos, storage])
            self.databases.append(cosmos.get_database_client(DATABASE))
            self.storage.append(storage)
        self.documents: list[dict[str, Any]] = []
        self.blobs: list[dict[str, Any]] = []
        self.report: dict[str, Any] = {
            "source_subscription": SOURCE.subscription,
            "target_subscription": TARGET.subscription,
            "cosmos": [], "blobs": [],
            "queue": "Not copied: engagement-intake is drained during final cutover.",
        }

    def close(self) -> None:
        for client in reversed(self.clients):
            if hasattr(client, "close"):
                client.close()
            else:
                client.__exit__(None, None, None)

    def inventory(self, detailed: bool) -> None:
        source_db, target_db = self.databases
        source_schema = {item["id"]: item for item in source_db.list_containers()}
        target_schema = {item["id"]: item for item in target_db.list_containers()}
        missing = set(source_schema) - set(target_schema)
        if missing:
            raise ValueError(f"Target Cosmos containers are missing: {sorted(missing)}")
        for name in sorted(source_schema):
            source_properties, target_properties = source_schema[name], target_schema[name]
            for field in ("partitionKey", "uniqueKeyPolicy", "defaultTtl"):
                if source_properties.get(field) != target_properties.get(field):
                    raise ValueError(f"Cosmos schema mismatch for {name}: {field}")
            source = source_db.get_container_client(name)
            target = target_db.get_container_client(name)
            row: dict[str, Any] = {"container": name}
            if not detailed:
                for label, container in (("source", source), ("target", target)):
                    row[label] = next(iter(container.query_items(
                        "SELECT VALUE COUNT(1) FROM c", enable_cross_partition_query=True
                    )))
            else:
                paths = source_properties["partitionKey"]["paths"]
                original_documents = list(source.read_all_items())
                target_documents = list(target.read_all_items())
                target_index = {
                    document_key(item, paths): clean_document(item)
                    for item in target_documents
                }
                row.update(
                    source=len(original_documents), target=len(target_documents),
                    missing=0, identical=0, conflicts=0, rewritten_urls=0, signed_legacy_urls=0,
                )
                for original in original_documents:
                    payload, rewritten, signed = prepare_document(original)
                    key = document_key(payload, paths)
                    if key != document_key(original, paths):
                        raise ValueError(f"URL rewriting would alter a partition key in {name}")
                    row["rewritten_urls"] += rewritten
                    row["signed_legacy_urls"] += signed
                    if key not in target_index:
                        row["missing"] += 1
                        self.documents.append({
                            "container": name, "body": payload, "paths": paths,
                            "target": target,
                        })
                    elif canonical(payload) == canonical(target_index[key]):
                        row["identical"] += 1
                    else:
                        row["conflicts"] += 1
            self.report["cosmos"].append(row)
            emit("cosmos-inventory", **row)

        source_storage, target_storage = self.storage
        source_containers = {item["name"] for item in source_storage.list_containers()}
        target_containers = {item["name"] for item in target_storage.list_containers()}
        missing = source_containers - target_containers
        if missing:
            raise ValueError(f"Target Blob containers are missing: {sorted(missing)}")
        for name in sorted(source_containers):
            source = source_storage.get_container_client(name)
            target = target_storage.get_container_client(name)
            originals = list(source.list_blobs())
            targets = {item.name: item for item in target.list_blobs()}
            row = {
                "container": name, "source": len(originals), "target": len(targets),
                "source_bytes": sum(item.size for item in originals),
                "target_bytes": sum(item.size for item in targets.values()),
            }
            if detailed:
                row.update(missing=0, identical=0, conflicts=0, preserved_managed_target=0)
                for item in originals:
                    if str(item.blob_type) not in ("BlobType.BLOCKBLOB", "BlobType.BlockBlob", "BlockBlob"):
                        raise ValueError(f"Unsupported non-block blob in {name}")
                    source_blob = source.get_blob_client(item.name)
                    properties = source_blob.get_blob_properties()
                    digest = blob_hash(source_blob, properties.etag)
                    action = {
                        "container": name, "source": source_blob,
                        "target": target.get_blob_client(item.name),
                        "properties": properties, "digest": digest,
                    }
                    if item.name not in targets:
                        row["missing"] += 1
                        self.blobs.append(action)
                    else:
                        target_properties = action["target"].get_blob_properties()
                        identical = (
                            digest == blob_hash(action["target"], target_properties.etag)
                            and blob_headers(properties) == blob_headers(target_properties)
                        )
                        if identical:
                            row["identical"] += 1
                        elif name in MANAGED_BLOBS:
                            row["preserved_managed_target"] += 1
                        else:
                            row["conflicts"] += 1
            self.report["blobs"].append(row)
            emit("blob-inventory", **row)

    def copy(self) -> None:
        conflicts = sum(row.get("conflicts", 0) for area in ("cosmos", "blobs")
                        for row in self.report[area])
        if conflicts:
            raise ValueError(f"{conflicts} destination conflicts; no copy has started.")
        for action in self.blobs:
            source, target, properties = action["source"], action["target"], action["properties"]
            with SpooledTemporaryFile(max_size=64 * 1024 * 1024) as staging:
                source.download_blob(
                    etag=properties.etag, match_condition=MatchConditions.IfNotModified
                ).readinto(staging)
                staging.seek(0)
                try:
                    target.upload_blob(
                        staging, overwrite=False, metadata=properties.metadata,
                        content_settings=properties.content_settings,
                    )
                except ResourceExistsError:
                    pass  # A concurrent creation must match the source below.
            after = target.get_blob_properties()
            if (blob_hash(target, after.etag) != action["digest"]
                    or blob_headers(after) != blob_headers(properties)):
                raise ValueError(f"Target blob verification failed in {action['container']}")
            emit("blob-verified", container=action["container"])
        for action in self.documents:
            target, payload, paths = action["target"], action["body"], action["paths"]
            try:
                stored = target.create_item(payload)
            except CosmosResourceExistsError:
                _, key_json = document_key(payload, paths)
                values = json.loads(key_json)
                stored = target.read_item(payload["id"], partition_key=(
                    values[0] if len(values) == 1 else values
                ))
            if canonical(clean_document(stored)) != canonical(payload):
                raise ValueError(f"Target Cosmos verification failed in {action['container']}")
            emit("document-verified", container=action["container"])
        emit("initial-copy-complete", copied_documents=len(self.documents), copied_blobs=len(self.blobs))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode", choices=("inventory", "plan", "copy", "verify", "compare-seeds"),
        nargs="?", default="inventory",
    )
    args = parser.parse_args()
    if args.mode == "compare-seeds":
        return compare_seeds()
    migration = None
    try:
        migration = Migration()
        migration.inventory(detailed=args.mode != "inventory")
        emit("report", **migration.report)
        if args.mode == "copy":
            migration.copy()
        elif args.mode in ("plan", "verify"):
            conflicts = sum(row.get("conflicts", 0) for area in ("cosmos", "blobs")
                            for row in migration.report[area])
            if conflicts:
                emit("conflicts", count=conflicts)
                return 2
            if args.mode == "verify" and (migration.documents or migration.blobs):
                emit("verification-incomplete", missing_documents=len(migration.documents),
                     missing_blobs=len(migration.blobs))
                return 3
        return 0
    except Exception as exc:
        emit("migration-stopped", error_type=type(exc).__name__, reason=str(exc))
        return 1
    finally:
        if migration is not None:
            migration.close()


if __name__ == "__main__":
    sys.exit(main())
