"""Checks for partition identity, URL handling, and non-destructive copying."""

import importlib.util
from pathlib import Path
import sys
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "migrate-terianix-platform-data.py"
SPEC = importlib.util.spec_from_file_location("terian_data_migration", SCRIPT)
migration = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = migration
SPEC.loader.exec_module(migration)


class MigrationTests(unittest.TestCase):
    def test_same_id_in_different_partitions_stays_distinct(self):
        first = {"id": "message-1", "conversation_id": "conversation-a"}
        second = {"id": "message-1", "conversation_id": "conversation-b"}
        self.assertNotEqual(
            migration.document_key(first, ["/conversation_id"]),
            migration.document_key(second, ["/conversation_id"]),
        )

    def test_nested_partition_key_and_missing_key(self):
        self.assertEqual(
            migration.document_key({"id": "1", "owner": {"id": "a"}}, ["/owner/id"]),
            ("1", '["a"]'),
        )
        with self.assertRaises(ValueError):
            migration.document_key({"id": "1"}, ["/owner/id"])

    def test_preserves_application_fields_and_rewrites_photo_url(self):
        original = {
            "id": "employee-1", "_etag": "old", "_ts": 100, "_private": True,
            "photo_url": "https://stterianservices.blob.core.windows.net/team-photos/a.jpg",
            "created_at": "2025-01-01", "metadata": {"_ts": "business-value"},
        }
        payload, changed, signed = migration.prepare_document(original)
        self.assertNotIn("_etag", payload)
        self.assertNotIn("_ts", payload)
        self.assertEqual(payload["metadata"]["_ts"], "business-value")
        self.assertTrue(payload["_private"])
        self.assertEqual(payload["created_at"], original["created_at"])
        self.assertEqual(
            payload["photo_url"],
            "https://stterianixservicesprod.blob.core.windows.net/team-photos/a.jpg",
        )
        self.assertEqual((changed, signed), (1, 0))
        self.assertIn("stterianservices", original["photo_url"])

    def test_historical_signed_url_is_not_rewritten_into_invalid_signature(self):
        url = "https://stterianservices.blob.core.windows.net/assets/a.pptx?sv=1&sig=example"
        payload, changed, signed = migration.prepare_document({"id": "1", "message": url})
        self.assertEqual(payload["message"], url)
        self.assertEqual((changed, signed), (0, 1))

    def test_expiring_document_is_not_silently_given_new_lifetime(self):
        with self.assertRaises(ValueError):
            migration.prepare_document({"id": "1", "ttl": 60, "_ts": 1})
        payload, _, _ = migration.prepare_document({"id": "2", "ttl": -1})
        self.assertEqual(payload["ttl"], -1)

    def test_conflicts_stop_copy_before_any_target_write(self):
        instance = migration.Migration.__new__(migration.Migration)
        instance.report = {"cosmos": [{"conflicts": 1}], "blobs": []}
        # Action processing would fail if copying started before the conflict gate.
        instance.blobs = [{"unusable": "sentinel"}]
        instance.documents = [{"unusable": "sentinel"}]
        with self.assertRaisesRegex(ValueError, "no copy has started"):
            instance.copy()

    def test_existing_target_document_is_checked_without_upsert(self):
        class Destination:
            def create_item(self, body):
                raise migration.CosmosResourceExistsError(status_code=409, message="exists")

            def read_item(self, item, partition_key):
                self.identity = (item, partition_key)
                return {"id": item, "email": partition_key, "value": 3, "_etag": "new"}

        target = Destination()
        instance = migration.Migration.__new__(migration.Migration)
        instance.report = {"cosmos": [], "blobs": []}
        instance.blobs = []
        instance.documents = [{
            "container": "accounts", "body": {"id": "1", "email": "example", "value": 3},
            "paths": ["/email"], "target": target,
        }]
        instance.copy()
        self.assertEqual(target.identity, ("1", "example"))
        instance.documents[0]["body"]["value"] = 4
        with self.assertRaisesRegex(ValueError, "verification failed"):
            instance.copy()


if __name__ == "__main__":
    unittest.main()
