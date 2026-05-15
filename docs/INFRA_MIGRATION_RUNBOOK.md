# Infrastructure Migration Runbook — `rg_platform` → `rg_corporate`

**Status:** Draft (covers the one-time refactor that introduced `rg_corporate`
and added the FastAPI backend on Azure Container Apps.)

**Scope:** Move the existing Static Web App into a new resource group and
stand up the backend (ACR, Container App, Key Vault, Log Analytics, UAMI)
alongside it. DNS stays where it is.

---

## Final layout

| Resource | Resource group | Notes |
|---|---|---|
| `terian-services.com` DNS zone | `rg_platform` | Owned by the App Service Domain; do not move. |
| DNS records (CNAME `www`, TXT `asuid`) | `rg_platform` | Live next to the zone; written by Terraform. |
| `awardnomplatform` storage account | `rg_platform` | Terraform state backend; unchanged. |
| `terian-services-frontend` Static Web App | `rg_corporate` | Moved here. |
| `terian-services-backend` Container App | `rg_corporate` | New. |
| `cae-terian-corporate-prod` Container App Environment | `rg_corporate` | New. |
| `acrterianservices` Container Registry | `rg_corporate` | New (Basic SKU). |
| `kv-terian-corp-prod` Key Vault | `rg_corporate` | New (RBAC mode). |
| `log-terian-corporate-prod` Log Analytics workspace | `rg_corporate` | New. |
| `uami-terian-services-backend` User-Assigned MI | `rg_corporate` | New. |

---

## Step 1 — Create `rg_corporate` only

Create the new resource group first, in isolation, so a subsequent `terraform
plan` against the full configuration shows clean diffs for the SWA move.

```bash
cd terraform/environments/prod
terraform init
terraform apply -target=azurerm_resource_group.corporate
```

Expected: one resource added (`azurerm_resource_group.corporate`). Nothing
else changes.

## Step 2 — Move the SWA cross-RG (Azure side)

The Static Web App is the only existing resource that has to move. Azure
supports cross-RG moves for SWA without recreating, which preserves the
deployment token and the custom-domain bindings.

```bash
SWA_ID=$(az staticwebapp show \
           --name terian-services-frontend \
           --resource-group rg_platform \
           --query id -o tsv)

az resource move \
  --destination-group rg_corporate \
  --ids "$SWA_ID"
```

Sanity-check the move:

```bash
az staticwebapp show \
  --name terian-services-frontend \
  --resource-group rg_corporate \
  --query "{id:id, default_host_name:defaultHostname}" -o table
```

## Step 3 — Reconcile Terraform state with the new resource path

The SWA's resource ID now includes `rg_corporate`. Drop the stale state and
re-import under the new path:

```bash
# Drop stale entries (no real-world deletion — `state rm` is local only)
terraform state rm module.static_web_app.azurerm_static_web_app.site
terraform state rm azurerm_static_web_app_custom_domain.apex
terraform state rm azurerm_static_web_app_custom_domain.www

# Re-import the SWA at its new location
NEW_SWA_ID=$(az staticwebapp show \
               --name terian-services-frontend \
               --resource-group rg_corporate \
               --query id -o tsv)

terraform import \
  module.static_web_app.azurerm_static_web_app.site \
  "$NEW_SWA_ID"

# Re-import the two custom-domain bindings.  The resource ID is:
#   <swa-id>/customDomains/<domain-name>
terraform import \
  azurerm_static_web_app_custom_domain.apex \
  "$NEW_SWA_ID/customDomains/terian-services.com"

terraform import \
  azurerm_static_web_app_custom_domain.www \
  "$NEW_SWA_ID/customDomains/www.terian-services.com"
```

Run `terraform plan` — the SWA + custom-domain blocks should show **no
changes**. The plan should now only show creates for the backend stack (ACR,
ACA env, ACA app, Key Vault, Log Analytics, UAMI, role assignments).

## Step 4 — Apply the full configuration

```bash
terraform apply
```

This creates the ACR, Log Analytics workspace, Container App Environment,
Key Vault, UAMI, role assignments, and the Container App itself (starting
with the hello-world placeholder image from `backend_image`).

Verify:

```bash
terraform output backend_fqdn
curl -sS "https://$(terraform output -raw backend_fqdn)/api/health"
# → {"status":"ok"}   (after the first revision is healthy)
```

The first response will be the quickstart container's response, not your
FastAPI. The next step replaces it.

## Step 5 — Create the Azure OpenAI key secret

```bash
KV_NAME=$(terraform output -raw key_vault_name)

az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name azure-openai-key \
  --value "<your-real-azure-openai-key>"
```

Then add the secret reference + env-var wiring to
`terraform/modules/container-app/main.tf` (see the inline comment in the
`container { … }` block) and re-apply.

## Step 6 — Configure GitHub Actions for CI

1. **Create the OIDC principal**, if you don't already have one. Either an
   AAD App Registration with a federated credential, or a User-Assigned
   Managed Identity with one. Subject for the federated credential:
   ```
   repo:<owner>/<repo>:ref:refs/heads/main
   ```
   Issuer: `https://token.actions.githubusercontent.com`
   Audience: `api://AzureADTokenExchange`

2. **Grab the principal object ID** and put it in
   `terraform.tfvars`:
   ```hcl
   github_actions_principal_id = "<object-id>"
   ```
   Then `terraform apply` — this grants AcrPush on the ACR and Contributor
   on the Container App Environment.

3. **Set GitHub repo secrets:**

   | Secret | Value |
   |---|---|
   | `AZURE_CLIENT_ID` | SP / MI client ID |
   | `AZURE_TENANT_ID` | AAD tenant GUID |
   | `AZURE_SUBSCRIPTION_ID` | Subscription GUID |
   | `TERIAN_ACR_NAME` | `acrterianservices` |
   | `TERIAN_BACKEND_RG` | `rg_corporate` |
   | `TERIAN_BACKEND_APP` | `terian-services-backend` |

4. **Trigger the workflow** by pushing any change under `backend/**`, or
   via `gh workflow run "Deploy Terian Services Backend (ACA)"`.

## Step 7 — Point the SPA at the backend

In `frontend/.env.production` (or wherever you set `VITE_API_URL`):

```
VITE_API_URL=https://<backend_fqdn>
```

For now this is the ACA-default hostname,
e.g. `terian-services-backend.<env-suffix>.eastus2.azurecontainerapps.io`.
Later we can swap to `api.terian-services.com` once the managed-cert flow
is wired in.

---

## Rollback

If something goes sideways during steps 2–4:

- **SWA move went bad.** Move it back: `az resource move --destination-group
  rg_platform --ids "$NEW_SWA_ID"`. Then `terraform state rm` + re-import
  under the original `rg_platform` path. No data is in the SWA, so the move
  itself is non-destructive.
- **TF apply created partial backend resources.** Run `terraform destroy
  -target=module.container_app` to remove just the backend stack, then
  re-apply once you know what to fix.
- **rg_corporate created but no longer wanted.** `terraform destroy
  -target=azurerm_resource_group.corporate` after first emptying it.

---

## Cost guardrails to set after Step 4

1. **Azure OpenAI deployment quota** — set a daily TPM cap on the deployment
   so a runaway loop can't drain the budget overnight.
2. **Container App max replicas** — `backend_max_replicas` is 3 by default.
   Raise only when you have real traffic; abuse + 100 replicas is the
   classic public-LLM-endpoint cost incident.
3. **Front Door rate limit** — if you front the ACA with AFD, configure a
   5–10 req/min per-IP rate limit on `/api/ask`.
