# Terian Services on the Terianix Platform

This Terraform tree is the target-subscription replacement for the
`terraform_legacy_subscription` tree.

It is intentionally a separate Terraform root with separate state. The legacy
and target environments must coexist while application data, deployment
identity, DNS, and custom domains are migrated.

## Why there are two production Terraform roots

`environments/production-dns` manages selected live website records for both
brands through Azure and Cloudflare providers, with its own state. The
applications are in `environments/prod`. Terian Services registration and live
DNS remain in the original Azure subscription; Terianix DNS stays in Cloudflare.

| Root | Purpose | DNS zone |
| --- | --- | --- |
| [`environments/prod`](environments/prod) | Production applications and target platform resources in subscription `2bb69129-5e74-44d9-af68-96d45633f667` | Shadow zone in `rg_terianix_platform`, with `ns*-08.azure-dns.*`; currently non-authoritative |
| [`environments/production-dns`](environments/production-dns/README.md) | The four live apex/www records for both brands | `terian-services.com`: Azure `rg_platform`, subscription `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca`, `ns*-04`; `terianix.ai`: existing Cloudflare zone |

While public delegation uses `ns*-04`, changing the shadow zone in `prod`
does not repair the public root domain. `production-dns` imports the existing
four website records and points each brand at its current Static Web App.
Mail, validation TXT, Award/Integrity Sentinel subdomains, zone resources,
registrations, and delegation are outside its selected-record scope.

Keep this root while it owns the live records. A future DNS migration needs an
explicit Terraform ownership handoff; deleting the folder is not a handoff.
See its README for the state key, expected plan, and operator commands.

## Module Layout

All three modules are copied from the legacy Terraform into this tree. The
target configuration uses these local copies, which can evolve independently
during migration:

```text
terraform_terianix_platform/
  modules/
    container-app/             # Backend, registry, identity, logs, secrets, AI
    data-store/                # Cosmos DB, blob containers, storage queue
    static-web-app/            # Frontend hosting
  environments/prod/
    main.tf                    # Context, tags, target application resource group
    backend.tf                 # Provider versions and state-backend declaration
    backend.hcl                # Target remote-state configuration
    backend-app.tf             # Backend module configuration
    data-store.tf              # Data module and data-access roles
    frontends.tf               # Both frontend module instances
    application-insights.tf    # Frontend telemetry
    github-actions.tf          # Target GitHub deployment identity and federation
    platform.tf                # Shared platform lookup and shadow DNS zone
    domains.tf                 # Staged Azure DNS and four TXT-validated bindings
    variables.tf
    outputs.tf
    terraform.tfvars
  environments/production-dns/    # Selected live Azure + Cloudflare website DNS
    README.md                    # Scope, ownership, credentials, operator steps
    main.tf                      # Providers and existing Azure frontend lookups
    terian-services.tf           # Azure apex alias and www CNAME
    terianix.tf                  # Cloudflare apex/www CNAMEs and ID discovery
    imports.tf                   # Adopt the existing four records
    outputs.tf                   # Managed-record inventory
    backend.hcl                  # Retains earlier authoritative-dns state key
    modules/cloudflare-inventory/ # Read-only zone/record discovery
    tests/                       # Mocked providers; no cloud access
```

Terraform loads all `.tf` files in `environments/prod` as one configuration.
The file split preserves the existing resource and module addresses, so it
requires no state moves. The legacy module files remain available to the
legacy root.

The target container-app module uses an explicit `github_actions_enabled`
flag for deployment-role counts. Its new principal ID is generated during
apply and cannot determine resource counts during the first plan.

## Subscription Boundary

| Environment | Subscription | Entra tenant | Terraform root |
| --- | --- | --- | --- |
| Archived legacy application configuration; do not apply | `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` | Historical tenant: `4d5f34d3-d97b-40c7-8704-edff856d3654` | `terraform_legacy_subscription/environments/prod` |
| Retained Azure website DNS | `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` | Current tenant: `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` | `terraform_terianix_platform/environments/production-dns` |
| Terianix target | `2bb69129-5e74-44d9-af68-96d45633f667` | `5979eb86-9af1-4c74-8e50-acbe7d6a5cf9` | `terraform_terianix_platform/environments/prod` |

The target root has validation guards for both IDs. Do not weaken those guards
to use this configuration against the legacy subscription.

## State

Target state is stored separately in:

```text
rg_terianix_platform/stterianixtfstate/tfstate
terian-services/terianix-platform/prod.tfstate
```

Do not migrate the legacy state into this key. The target resources are a
parallel rebuild, not moved instances of the legacy resources.

## Production Root Ownership During Migration

This section describes `environments/prod`. `production-dns` owns only the four
live website records described above and uses a separate state. Its backend
retains the earlier `terian-services/authoritative-dns/terraform.tfstate` key
so the folder rename cannot fork an existing apex-record state.

This root initially owns:

- A target Terian Services application resource group.
- Application-specific platform resources placed in the existing shared
  `rg_terianix_platform` resource group.
- A non-authoritative shadow `terian-services.com` Azure DNS zone in
  `rg_terianix_platform`.
- Dedicated target compute, data, secrets, AI, monitoring, and frontend
  resources.
- A dedicated target-tenant GitHub Actions identity federated only to the
  `DTerian64/Terian_Services` repository and `terianix-platform-prod`
  environment.

It deliberately does not initially own:

- Registrar delegation for `terian-services.com`.
- The App Service Domain registration.
- Existing records in the live Azure DNS zone.
- Existing Cloudflare records for `terianix.ai`.
- Production custom-domain bindings (added deliberately during Step 8).
- Legacy CIAM directories.

Those singleton resources need an explicit state handoff or cutover. Managing
them from both Terraform states would be unsafe.

The Integrity Sentinel platform state remains the owner of
`rg_terianix_platform` itself and of `stterianixtfstate`. This Terian Services
state reads that resource group as a data source and must never import or claim
the resource group or state storage account.

## First Plan

From `terraform_terianix_platform/environments/prod`:

```powershell
if (!(Test-Path terraform.tfvars)) {
  Copy-Item terraform.tfvars.template terraform.tfvars
}
terraform init '-backend-config=backend.hcl'
terraform validate
terraform plan -out=terraform.tfplan
```

Set secrets through environment variables rather than committing values:

```powershell
$env:TF_VAR_serper_api_key = "..."
$env:TF_VAR_smtp_password = "..."
```

Review all global resource names before the first apply. Azure Container
Registry, Storage, Key Vault, Cosmos DB, and Azure OpenAI names must be globally
available.

After the first apply, configure the `terianix-platform-prod` GitHub Environment
with these Terraform outputs:

| GitHub variable | Terraform value |
| --- | --- |
| `AZURE_CLIENT_ID` | `github_actions_client_id` |
| `AZURE_TENANT_ID` | `tenant_id` |
| `AZURE_SUBSCRIPTION_ID` | `subscription_id` |

## Migration Stages

The deployment work for slice 2 is described in
[Slice 2: Target Application Deployment](docs/SLICE_2_DEPLOYMENT.md).
It reuses all five existing workflows and selects the target GitHub
Environment when the source branch is `terianix-platform`.

The initial application data copy is described in
[Step 5: Initial Data Migration](docs/STEP_5_DATA_MIGRATION.md).

The two-domain cutover is described in
[Step 8: Custom Domains and Authoritative DNS](docs/STEP_8_DOMAIN_CUTOVER.md).
The current DNS design keeps `terian-services.com` registered and hosted in
Azure and `terianix.ai` hosted in Cloudflare. Selected live website records
are managed together in
[`environments/production-dns`](environments/production-dns/README.md).
Earlier instructions requiring manual-only Cloudflare changes or moving
Terian Services registration to Cloudflare are historical alternatives, not
the current deployment procedure.
The prepared Azure shadow zone remains in Terraform until reviewed cleanup;
do not delegate to its name servers or destroy it automatically.
The `prod` application root has no Cloudflare provider; the separate
`production-dns` root has Azure and Cloudflare providers. Azure custom-domain
bindings remain in `prod`. A narrowly
scoped temporary root at `environments/source-domain-validation` publishes
target-validation TXT in the currently authoritative source zone, using local
state under the ignored cutover folder. Its opt-in apex correction imports the
existing root TXT record set and appends the saved target proof while preserving
live values, TTL, and tags. Never reapply another state owning that record set
after this approved takeover. It is not a permanent production
dependency. The domain registration/delegation remains a separate approval gate.

The final objective is permanent deletion of the old subscription, not permanent
coexistence. Source registration, source state storage, historical blob links,
and old DNS endpoints must be resolved before that deletion. Legacy Award DNS,
including demo/synthetics TXT, is excluded from the target zone and reported in
`dns_retirement_review`. The four new-platform Award hostnames already in
Cloudflare remain unchanged; they are not part of the marketing-site rebind.

1. Provision and validate target infrastructure on Azure-provided hostnames.
2. Configure target-tenant GitHub OIDC and deploy application artifacts.
3. Copy Cosmos DB and Blob data; drain or replay the Storage queue.
4. Validate API, AI, storage, monitoring, email, and frontend workflows.
5. Synchronize the final data delta and stop legacy writes.
6. Transfer DNS and custom-domain ownership intentionally.
7. Observe the target during a rollback window.
8. Delete `rg_corporate`, then resolve the remaining `rg_platform` ownership
   boundaries before deleting it.

