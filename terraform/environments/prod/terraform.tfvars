# environments/prod/terraform.tfvars
# ─────────────────────────────────────────────────────────────────────────────
# Two-resource-group layout:
#   rg_platform   — pre-existing — DNS zone, App Service Domain, TF state SA
#   rg_corporate  — created here — SWA, ACA, ACR, Key Vault, Log Analytics
#
# First-time apply
# ────────────────
#   1. terraform init
#   2. terraform apply -target=azurerm_resource_group.corporate
#   3. (Migration: move existing SWA into rg_corporate — see main.tf header)
#   4. terraform apply
#   5. az keyvault secret set --vault-name <kv> --name azure-openai-key --value <key>
#   6. Push to main → deploy-backend.yml builds + pushes + updates the ACA.
# ─────────────────────────────────────────────────────────────────────────────

# ── Resource groups ────────────────────────────────────────────────────────
corporate_resource_group_name = "rg_corporate"
dns_resource_group_name       = "rg_platform"
location                      = "eastus2"

# ── DNS ────────────────────────────────────────────────────────────────────
dns_zone_name = "terian-services.com"

# ── SWA (frontend) ─────────────────────────────────────────────────────────
swa_name                  = "terian-services-frontend"
swa_verification_dns_name = "asuid"
swa_verification_token    = "_85841r7fomw0t6m7orfn8l2gtb0mohk"

# ── ACA (backend) ──────────────────────────────────────────────────────────
aca_app_name                  = "terian-services-backend"
aca_environment_name          = "cae-terian-corporate-prod"
aca_uami_name                 = "uami-terian-services-backend"
acr_name                      = "acrterianservices"
log_analytics_workspace_name  = "log-terian-corporate-prod"
key_vault_name                = "kv-terian-corp-prod"

# Replicas — 0 = scale-to-zero (cheapest; ~2–4s cold start)
backend_min_replicas = 0
backend_max_replicas = 3

# Azure OpenAI — provisioned by Terraform in rg_corporate, dedicated to the
# public-site bot.  Separate from the Award Nomination product's endpoint.
# gpt-5.4-nano: manually provisioned via Azure UI, imported into Terraform state.
openai_account_name      = "oai-terian-corp-prod"
openai_deployment_name   = "gpt-5.4-nano"
openai_model_name        = "gpt-5.4-nano"
openai_model_version     = "2026-03-17"
openai_tpm_capacity      = 5
azure_openai_api_version = "2024-12-01-preview"

# Allowed CORS origins for /api/*
backend_allowed_origins = "https://terian-services.com,https://www.terian-services.com"

# Placeholder image; deploy-backend.yml overrides this on every push to main.
# Terraform ignores image drift on subsequent applies (see container-app module).
backend_image = "mcr.microsoft.com/k8se/quickstart:latest"

# GitHub Actions OIDC principal (object ID).  Empty = skip the role
# assignments; grant AcrPush + Container App Contributor manually if so.
# Set after creating the federated credential (see deploy-backend.yml header).
github_actions_principal_id = ""
