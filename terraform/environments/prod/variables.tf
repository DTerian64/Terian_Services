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

# ── Azure OpenAI — classifier deployment ────────────────────────────────────

variable "openai_classify_deployment_name" {
  description = "Model deployment name for AgentRouter intent classification. Injected as AZURE_OPENAI_CLASSIFY_MODEL."
  type        = string
  default     = "gpt-4.1-mini"
}

variable "openai_classify_model_name" {
  description = "Model family for the classifier deployment."
  type        = string
  default     = "gpt-4.1-mini"
}

variable "openai_classify_model_version" {
  description = "Model snapshot version for the classifier deployment."
  type        = string
  default     = "2025-04-14"
}

variable "openai_classify_tpm_capacity" {
  description = "Tokens-per-minute capacity in thousands for the classifier. 2 = 2,000 TPM — sufficient since classify() emits ≤ 10 tokens per call."
  type        = number
  default     = 2
}

# ── Serper (LiveDataAgent web search tool) ───────────────────────────────────

variable "serper_api_key" {
  description = "Serper API key for the search_web tool (https://serper.dev). Sensitive — inject via tfvars; never commit the real value."
  type        = string
  sensitive   = true
  default     = ""
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

variable "app_insights_log_analytics_resource_id" {
  description = "Full resource ID of the Log Analytics workspace backing the App Insights instance. Required for LogsQueryClient KQL query access."
  type        = string
  default     = ""
}

variable "app_insights_workspace_id" {
  description = "Log Analytics workspace ID (GUID) backing the Award Nomination System's App Insights instance."
  type        = string
  default     = ""
}

# ── SMTP (Zoho) ──────────────────────────────────────────────────────────────

variable "smtp_user" {
  description = "SMTP sender address (e.g. sales@terian-services.com). Used for SMTP auth and the From header."
  type        = string
  default     = "sales@terian-services.com"
}

variable "smtp_host" {
  description = "Outgoing SMTP server hostname. Zoho Workplace: smtppro.zoho.com. Port is always 587/STARTTLS."
  type        = string
  default     = "smtppro.zoho.com"
}

variable "contact_notify_email" {
  description = "Destination inbox for contact form notifications. Defaults to smtp_user if empty."
  type        = string
  default     = ""
}

variable "smtp_password" {
  description = "SMTP App Password. Sensitive — inject via TF_VAR_smtp_password or a GitHub Actions secret; never commit."
  type        = string
  sensitive   = true
  default     = ""
}

# ── Award Nomination compute + database ──────────────────────────────────────

variable "award_aca_primary_resource_id" {
  description = "ARM resource ID of the Award Nomination primary ACA (for replica count metrics)."
  type        = string
  default     = ""
}

variable "award_aca_secondary_resource_id" {
  description = "ARM resource ID of the Award Nomination secondary ACA (for replica count metrics)."
  type        = string
  default     = ""
}

variable "award_sql_db_resource_id" {
  description = "ARM resource ID of the Award Nomination SQL database (for storage metrics)."
  type        = string
  default     = ""
}

variable "award_appi_frontend_resource_id" {
  description = "ARM resource ID of the Award Nomination frontend App Insights component (appi-award-frontend-sandbox). Used for pageViews KQL queries."
  type        = string
  default     = ""
}

variable "award_appi_frontend_log_analytics_resource_id" {
  description = "ARM resource ID of the Log Analytics workspace backing the frontend App Insights component. Required for Monitoring Reader role assignment."
  type        = string
  default     = ""
}

# ── Data store ───────────────────────────────────────────────────────────────

variable "storage_account_name" {
  description = "Storage Account name for media assets (photos). Must be globally unique, 3–24 lowercase alphanumeric."
  type        = string
  default     = "stterianservices"
}

variable "cosmos_account_name" {
  description = "Cosmos DB account name. Must be globally unique, 3–44 lowercase alphanumeric + hyphens."
  type        = string
  default     = "terian-services-cosmos-db"
}

variable "cosmos_database_name" {
  description = "Cosmos DB SQL database name."
  type        = string
  default     = "terian-services"
}

variable "admin_principal_id" {
  description = "Object ID of the admin user (david64.terian@terian-services.com). Granted Storage Blob Data Contributor + Cosmos DB Built-in Data Contributor for direct data access."
  type        = string
  default     = ""
}

# ── Cloudflare (terianix.ai DNS) ─────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone:DNS:Edit permission for the terianix.ai zone. Sensitive — inject via TF_VAR_cloudflare_api_token or a GitHub Actions secret; never commit."
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for terianix.ai — find it on the zone's Overview page in the Cloudflare dashboard."
  type        = string
}

# ── Terianix Static Web App (terianix.ai frontend) ───────────────────────────

variable "terianix_swa_name" {
  description = "Static Web App resource name for the terianix.ai frontend."
  type        = string
  default     = "terianix-frontend"
}

variable "terianix_swa_verification_dns_name" {
  description = "DNS name for the SWA apex-domain ownership TXT record. Azure SWA (unlike App Service) places this at the root '@' for external DNS providers like Cloudflare."
  type        = string
  default     = "@"
}

variable "terianix_swa_verification_token" {
  description = "SWA custom-domain verification token for terianix.ai — populate after first apply (get it from the Azure portal or the terianix_swa_default_hostname output, then re-apply to create the TXT record and apex binding)."
  type        = string
  default     = ""
}
