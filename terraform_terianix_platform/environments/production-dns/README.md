# Production website DNS: Terian Services and Terianix

## Why this folder exists

This production Terraform root manages selected live DNS records for both
brands. Each domain stays at its current DNS provider:

| Domain | Authoritative provider | Zone location |
| --- | --- | --- |
| `terian-services.com` | Azure DNS, `ns*-04.azure-dns.*` | `rg_platform`, subscription `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` |
| `terianix.ai` | Cloudflare | Existing active `terianix.ai` zone |

Applications and Azure custom-domain/certificate bindings remain owned by
`../prod` in subscription `2bb69129-5e74-44d9-af68-96d45633f667`. That root also
owns a different, non-authoritative `terian-services.com` shadow zone in
`rg_terianix_platform` (`ns*-08`). Editing the shadow zone does not repair public
DNS while delegation uses `ns*-04`.

Keeping live DNS in its own state allows both providers' website records to be
reviewed together without planning the application stack. Both Azure
subscriptions currently use tenant `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9`.

## Exactly which records Terraform owns

| Hostname | Record | Desired target | Terraform address |
| --- | --- | --- | --- |
| `terian-services.com` | Azure `A/@` alias | `terian-services-frontend-platform` Static Web App | `azurerm_dns_a_record.apex_alias` |
| `www.terian-services.com` | Azure `CNAME/www` | That app's default hostname | `azurerm_dns_cname_record.www` |
| `terianix.ai` | Cloudflare apex CNAME | `terianix-frontend-platform` default hostname | `cloudflare_dns_record.terianix_website["terianix.ai"]` |
| `www.terianix.ai` | Cloudflare CNAME | That app's default hostname | `cloudflare_dns_record.terianix_website["www.terianix.ai"]` |

The frontend hostnames are read from the existing Azure Static Web Apps. The
Terian Services alias follows its Azure resource instead of pinning a shared IP.
Cloudflare flattens its apex CNAME automatically. Both Cloudflare website
records use DNS-only (`proxied = false`); all four records use TTL 300.
Existing Azure `www` tags and Cloudflare record comments, tags, and per-record
settings are preserved. The Azure apex metadata is the previously reviewed
`environment=prod`, `managed_by=terraform`, `project=terian-services` set.

The four records are imported before updates. Cloudflare zone and CNAME IDs
are discovered by exact name during the operator's plan; no API token or
record IDs are committed. The token is a sensitive input in the Git-ignored
`terraform.tfvars` file. A missing/ambiguous Cloudflare CNAME or a zone that
is not active stops the plan for investigation rather than creating a second
record. Azure also checks the expected authoritative zone's nameservers.
All four records have `prevent_destroy`.

This is **selected-record management**, not whole-zone ownership:

| Records/resources outside this root | Ownership/handling |
| --- | --- |
| Domain registrations, registrar delegation, apex NS/SOA, zone resources | Existing provider/registration management; unchanged |
| MX, SPF, DKIM, DMARC and other mail/verification records | Existing records remain with their current owner; not adopted or deleted |
| Azure/Cloudflare SWA validation TXT | Existing validation process; the temporary `../source-domain-validation` root may own Azure proof records |
| Award hostnames, `is.terianix.ai` delegation, `sandbox.is.terianix.ai`, other subdomains | Existing application/platform owners; not adopted or deleted |
| Azure SWA bindings and managed TLS certificates | `../prod` |
| Azure shadow zone and its records | `../prod`; separate from authoritative production DNS |

Adding other required records is a deliberate extension: inventory the exact
record set, confirm its sole Terraform owner, preserve its values and metadata,
then add configuration and imports. Do not bulk-adopt application-owned records
or assume a DNS export includes Cloudflare record IDs or all zone settings.

## State and takeover from the archived root

The folder was renamed from `authoritative-dns` to `production-dns`. The backend
intentionally retains its earlier key:

```text
rg_terianix_platform/stterianixtfstate/tfstate
terian-services/authoritative-dns/terraform.tfstate
```

A folder rename does not require renaming its state key. Keeping this key and
the original `azurerm_dns_a_record.apex_alias` address preserves an earlier apex
apply if one was performed. No state migration or new empty backend is needed.
Do not change the key merely to match the folder name.

The archived `terraform_legacy_subscription` root previously defined these four
records. Its Cloudflare resource type was v4 `cloudflare_record`; this root
adopts the existing IDs into v5 `cloudflare_dns_record` resources using imports.
Keep the archived root frozen: applying it would restore retired frontend
targets. Do not apply the old and new owners in parallel. This is an intentional
takeover, not an instruction to destroy the legacy records or reapply its stack.
Any future revival of that stack requires removing its old state ownership
without destroying the live DNS records first.

This root reads existing zones/frontends but does not own their lifecycle. Keep
the root while it owns these live records; a future DNS migration requires an
explicit ownership handoff before retiring its configuration.

## Review and apply (operator only)

Codex prepares local configuration and local checks. You perform all Azure and
Cloudflare operations after reviewing the files and plan.

Prerequisites:

- Azure access to the retained DNS zone, read access to the two target Static
  Web Apps, and permissions to resolve the cross-subscription alias target.
- Access to the existing platform Terraform backend.
- A Cloudflare API token scoped only to `terianix.ai`, with Zone Read and DNS
  Edit permissions. Set `cloudflare_api_token` in the ignored `terraform.tfvars`
  file; the provider reads this sensitive Terraform input directly. A
  `CLOUDFLARE_API_TOKEN` shell variable is no longer required.
- The existing four website records must be present. Imports are idempotent;
  a record already owned by this state is not imported again.

From this directory, copy `terraform.tfvars.template` to `terraform.tfvars`
if the local file does not already exist, then fill in your token:

```hcl
cloudflare_api_token = "your-cloudflare-api-token"
```

`terraform.tfvars` is ignored by Git. The template must retain only the blank
placeholder. `sensitive = true` redacts the input from ordinary Terraform output;
it does not encrypt the local file or a saved plan containing the input.
An empty token is rejected during planning.

Then run:

```powershell
terraform init '-backend-config=backend.hcl'
terraform validate
terraform plan '-out=production-dns.tfplan'
terraform show 'production-dns.tfplan'
```

On first adoption, expect four imports (three if this state already owns the
Azure apex). Review in-place corrections to the empty Azure apex, stale
website targets, TTLs, or Cloudflare proxy flags. The plan should create and
destroy **zero** records and contain no changes outside the four website
records. An already-correct `www` should not have a destination change.
Unrelated mail and validation TXT records can coexist at the apex and must
remain untouched.

The legacy root is archived but can still have stale ownership in its old
state. Imports here do not automatically remove entries from another state.
If you retain that state for anything beyond archival reference, remove the
four old ownership entries without destroying the records before applying any
other resources from it. Never run its old saved plans against these records.

After reviewing the saved plan, apply that exact file:

```powershell
terraform apply 'production-dns.tfplan'
terraform output managed_website_records
```

Verify root and `www` DNS resolution and HTTPS for both brands. Later plans
should be unchanged. `prevent_destroy` guards against replacement/deletion
while these resource blocks remain in configuration; it does not protect
against removing the blocks or applying a competing state.

## Local tests

With providers installed, `terraform test` uses mocked providers and does not
contact Azure, Cloudflare, or the remote backend. The tests check the four-record
scope, destination routing, existing metadata, and rejection of a wrong zone or
missing/ambiguous Cloudflare records. A live plan remains an operator step.

The read-only `modules/cloudflare-inventory` child module performs exact-name
lookups during a live plan. Tests override its inventory output so they can
exercise missing/ambiguous-record guards without cloud access; they do not
claim to test Cloudflare API behavior or live credentials.

References: [Cloudflare Terraform provider](https://developers.cloudflare.com/terraform/),
[existing-resource imports](https://developers.cloudflare.com/terraform/advanced-topics/import-cloudflare-resources/),
[Azure apex alias](https://learn.microsoft.com/en-us/azure/static-web-apps/apex-domain-azure-dns).
