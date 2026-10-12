# Step 5: Initial Cosmos DB and Blob Data Copy

The initial copy uses `scripts/migrate-terianix-platform-data.py`. Terraform
owns the destination infrastructure; the script copies application data.

| Setting | Source | Target |
| --- | --- | --- |
| Subscription | `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` | `2bb69129-5e74-44d9-af68-96d45633f667` |
| Cosmos account | `terian-services-cosmos-db` | `terianix-services-prod` |
| Database | `terian-services` | `terian-services` |
| Blob account | `stterianservices` | `stterianixservicesprod` |

## Existing Data Loading

| Script | Container | Seed records | Observed source records |
| --- | --- | --- | --- |
| `seed_email_templates.py` | `email_templates` | 6 | 6 |
| `seed_jobs.py` | `jobs` | 1 | 2 |
| `seed_engagement.py` | `engagement_details` | 2 | 2 |

All seed definitions matched their corresponding source records during the
read-only comparison on October 9, 2026. The source has an additional job,
`research-consultant-adversarial-ml`, that is absent from `seed_jobs.py`.

The seed scripts upsert configuration records. They do not migrate accounts,
conversations, messages, communications, applications, employees, or assets.
The migration copies the actual source records instead.

## Initial Inventory

The read-only inventory found 227 source Cosmos documents and 3 target test
documents. All 12 source containers have matching destination partition keys,
unique-key definitions, and default TTL settings.

| Blob container | Source | Target before copy |
| --- | --- | --- |
| `ai-attachments` | 3 | 0 |
| `ai-prompts` | 9 | 9 |
| `blob-templates` | 33 | 33 |
| `client-com-attachments` | 2 | 0 |
| `engagement-assets` | 14 | 0 |
| `job-applications` | 1 | 0 |
| `legal-templates` | 0 | 0 |
| `team-photos` | 5 | 0 |

Counts can change while either application accepts writes.

## Initial Copy Result

On October 9, 2026, the copy completed successfully:

- Created and verified 227 Cosmos documents across the 12 source containers.
- Retained the 3 target test documents.
- Copied and verified 25 missing blobs.
- Confirmed the 42 existing prompts/templates already matched source contents.
- Rewrote 12 unsigned Blob URLs, including all 3 employee photo URLs.
- Preserved 7 historical signed links in AI messages for separate cutover review.
- Performed no source writes, deletes, queue transfers, or Terraform applies.

The destination now has 230 documents and 67 current blobs at the initial
copy boundary, subject to subsequent writes by either live application.

Independent verification completed with zero missing documents, conflicting
records, missing blobs, or content/header mismatches. All 227 transformed
source documents and all 67 source blobs matched their target counterparts.

Target API checks also passed:

- Health: `{"status":"ok"}`.
- Team endpoint: 3 members, each with a target-storage photo returning HTTP 200.
- Jobs endpoint: 2 jobs, including the job absent from the seed script.
- Engagement endpoints: Award Nomination and Contract Services both load.
- All seven migration unit tests pass.

## Copy Behavior

- Uses Azure CLI credentials explicitly selected by subscription to support the
  two different tenants' cached logins.
- Checks all source containers against the existing destination schema.
- Preserves document IDs, partition keys, and application fields.
- Removes Cosmos-managed system fields that the destination regenerates.
- Rewrites unsigned source Blob URLs, including employee photos, to the target.
- Preserves historical signed URLs as text and reports their count. A source
  signature cannot be reused for the destination account.
- Creates missing documents and skips identical ones. Different existing
  business documents stop copying before any writes.
- Copies missing current block blobs with their headers and metadata, and
  verifies their SHA-256 content hashes.
- Preserves existing target prompt/template versions when they differ because
  GitHub owns those two containers' current configuration.
- Copies blobs before documents and performs no deletes or replacements.

This copies current data, not blob version history, snapshots, soft-deleted
objects, change-feed history, or backups. Expiring item TTLs and undefined
partition keys stop the tool for explicit handling.

## Commands

Run from the repository root. Azure CLI needs authenticated sessions for both
subscriptions and Cosmos/Blob data-plane access. Python dependencies are
included in `backend/requirements.txt`.

```powershell
python scripts/migrate-terianix-platform-data.py inventory
python scripts/migrate-terianix-platform-data.py plan
python scripts/migrate-terianix-platform-data.py copy
python scripts/migrate-terianix-platform-data.py verify
```

`inventory`, `plan`, and `verify` are read-only. `copy` performs a complete
fresh preflight before its first write. Output contains counts and container
names, not customer documents or file contents.

Rerunning the initial copy fills missing objects. Changed records and source
deletions need reconciliation during final synchronization; this initial tool
deliberately refuses to overwrite conflicting target data.

The `engagement-intake` queue is not copied or consumed here. Its workers send
emails and generate presentations, so draining/replay belongs to final cutover.

## Validation and Remaining Work

Run `verify` after copying. Check target team photos, jobs, engagement/pricing
pages, and conversation retrieval. Preserve existing target test records.

Before retiring the source account, reconcile writes made after this initial
copy, drain queues, resolve historical signed links as required, and complete
application and DNS cutover.

Sources:

- [Azure CLI subscription selection](https://learn.microsoft.com/python/api/azure-identity/azure.identity.azureclicredential)
- [Cosmos document create/read operations](https://learn.microsoft.com/python/api/azure-cosmos/azure.cosmos.containerproxy)
- [Blob upload/download operations](https://learn.microsoft.com/python/api/azure-storage-blob/azure.storage.blob.blobclient)
