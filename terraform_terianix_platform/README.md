# Terian Services on the Terianix Platform

This Terraform tree is the target-subscription replacement for the legacy
`terraform` tree.

It is intentionally a separate Terraform root with separate state. The legacy
and target environments must coexist while application data, deployment
identity, DNS, and custom domains are migrated.

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
    variables.tf
    outputs.tf
    terraform.tfvars
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
| Legacy | `4ddf12bb-5397-445f-bcaa-df4c7d3dfdca` | `4d5f34d3-d97b-40c7-8704-edff856d3654` | `terraform/environments/prod` |
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

## Ownership During Migration

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
- Production custom-domain bindings.
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

1. Provision and validate target infrastructure on Azure-provided hostnames.
2. Configure target-tenant GitHub OIDC and deploy application artifacts.
3. Copy Cosmos DB and Blob data; drain or replay the Storage queue.
4. Validate API, AI, storage, monitoring, email, and frontend workflows.
5. Synchronize the final data delta and stop legacy writes.
6. Transfer DNS and custom-domain ownership intentionally.
7. Observe the target during a rollback window.
8. Delete `rg_corporate`, then resolve the remaining `rg_platform` ownership
   boundaries before deleting it.

