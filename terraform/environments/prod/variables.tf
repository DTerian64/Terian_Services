# environments/prod/variables.tf
# ─────────────────────────────────────────────────────────────────────────────
# Two resource groups are in play:
#
#   rg_platform   — pre-existing.  Owns the terian-services.com App Service
#                   Domain, its DNS zone, and the Terraform-state storage
#                   account (awardnomplatform).  DNS records have to live
#                   next to the zone, so we still read it from here.
#
#   rg_corporate  — managed by this Terraform.  Owns every Terian Services
#                   compute resource: Static Web App (frontend),
#                   Container App + environment (backend), Container
#                   Registry, Key Vault, Log Analytics, managed identities.
# ─────────────────────────────────────────────────────────────────────────────

# ── Resource groups ─────────────────────────────────────────────────────────

variable "corporate_resource_group_name" {
  description = "Resource group that owns all Terian Services compute (frontend, backend, ACR, Key Vault, Log Analytics)."
  type        = string
  default     = "rg_corporate"
}

variable "dns_resource_group_name" {
  description = "Resource group that owns the terian-services.com DNS zone (existing rg_platform)."
  type        = string
  default     = "rg_platform"
}

variable "location" {
  description = "Azure region for all Terian Services resources."
  type        = string
  default     = "eastus2"
}

# ── DNS ─────────────────────────────────────────────────────────────────────

variable "dns_zone_name" {
  description = "DNS zone name — must match the existing App Service Domain."
  type        = string
  default     = "terian-services.com"
}

# ── Static Web App (frontend) ──────────────────────────────────────────────

variable "swa_name" {
  description = "Static Web App resource name."
  type        = string
  default     = "terian-services-frontend"
}

# The SWA currently lives in rg_platform. The cross-RG move into rg_corporate
# is deferred (Phase 2 of the migration runbook) because it requires a planned
# apex-HTTPS outage. When ready, flip this default to "rg_corporate" AND
# follow the state-rm + import dance from the runbook.
variable "swa_resource_group_name" {
  description = "Resource group hosting the Static Web App. Keep as rg_platform until the cross-RG move is done."
  type        = string
  default     = "rg_platform"
}

variable "swa_verification_dns_name" {
  description = "DNS TXT record name for SWA ownership verification (usually 'asuid' for apex)."
  type        = string
  default     = "asuid"
}

variable "swa_verification_token" {
  description = "SWA custom-domain verification token — fill in after first apply."
  type        = string
  default     = ""
}

# ── Container App (backend) ────────────────────────────────────────────────

variable "aca_app_name" {
  description = "Container App resource name."
  type        = string
  default     = "terian-services-backend"
}

variable "aca_environment_name" {
  description = "Container App Environment name (shared across services in this RG)."
  type        = string
  default     = "cae-terian-corporate-prod"
}

variable "aca_uami_name" {
  description = "User-assigned managed identity used by the Container App (ACR pull + Key Vault read)."
  type        = string
  default     = "uami-terian-services-backend"
}

variable "acr_name" {
  description = "Azure Container Registry name (globally unique, alphanumeric, 5–50 chars)."
  type        = string
  default     = "acrterianservices"
}

variable "log_analytics_workspace_name" {
  description = "Log Analytics workspace name (logs sink for the ACA environment)."
  type        = string
  default     = "log-terian-corporate-prod"
}

variable "key_vault_name" {
  description = "Key Vault that stores backend secrets (e.g. AZURE_OPENAI_KEY)."
  type        = string
  default     = "kv-terian-corp-prod"
}

variable "backend_image" {
  description = "Container image reference for the backend (ACR login server + image + tag). Falls back to a hello-world image on first apply; GitHub Actions overrides this via 'az containerapp update'."
  type        = string
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

variable "backend_min_replicas" {
  description = "Minimum running replicas. Set to 0 for scale-to-zero (cheapest), 1 to eliminate cold starts."
  type        = number
  default     = 0
}

variable "backend_max_replicas" {
  description = "Maximum running replicas for autoscale."
  type        = number
  default     = 3
}

# ── Azure OpenAI (provisioned in rg_corporate, dedicated to the public site) ─

variable "openai_account_name" {
  description = "Azure OpenAI cognitive account name. Becomes the endpoint subdomain: https://<name>.openai.azure.com/"
  type        = string
  default     = "oai-terian-corp-prod"
}

variable "openai_deployment_name" {
  description = "Model deployment name — the value the backend sends as AZURE_OPENAI_MODEL."
  type        = string
  default     = "gpt-5.4-nano"
}

variable "openai_model_name" {
  description = "Model family to deploy."
  type        = string
  default     = "gpt-5.4-nano"
}

variable "openai_model_version" {
  description = "Model snapshot version for the deployment."
  type        = string
  default     = "2026-03-17"
}

variable "openai_tpm_capacity" {
  description = "Tokens-per-minute capacity in thousands (5 = 5,000 TPM). Caps cost during a traffic spike."
  type        = number
  default     = 5
}

variable "azure_openai_api_version" {
  description = "Azure OpenAI API version used by the backend."
  type        = string
  default     = "2024-12-01-preview"
}

variable "backend_allowed_origins" {
  description = "Comma-separated list of origins allowed to call /api/*."
  type        = string
  default     = "https://terian-services.com,https://www.terian-services.com"
}

# ── DevOps principal (for federated GitHub Actions login) ──────────────────

variable "github_actions_principal_id" {
  description = "Object ID of the AAD service principal / UAMI used by GitHub Actions OIDC. Granted AcrPush on the ACR and Contributor on the Container App. Leave blank to skip the role assignments and grant them manually."
  type        = string
  default     = ""
}

# ── App Insights (Award Nomination System — read-only metrics) ───────────────

variable "app_insights_resource_id" {
  description = "Full resource ID of the Award Nomination System's Application Insights component. Used to scope the Monitoring Reader role assignment on the backend UAMI."
  type        = string
  default     = ""
}

variable "app_insights_workspace_id" {
  description = "Log Analytics workspace ID (GUID) backing the Award Nomination System's App Insights instance."
  type        = string
  default     = ""
}
