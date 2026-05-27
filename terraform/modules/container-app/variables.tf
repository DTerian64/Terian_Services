# modules/container-app/variables.tf

variable "resource_group_name" {
  description = "Resource group to deploy all backend resources into."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "app_name" {
  description = "Container App resource name."
  type        = string
}

variable "environment_name" {
  description = "Container App Environment name."
  type        = string
}

variable "uami_name" {
  description = "User-assigned managed identity name (ACR pull + Key Vault read)."
  type        = string
}

variable "acr_name" {
  description = "Azure Container Registry name (globally unique, alphanumeric, 5–50 chars)."
  type        = string
}

variable "log_analytics_workspace_name" {
  description = "Log Analytics workspace name."
  type        = string
}

variable "key_vault_name" {
  description = "Key Vault that stores backend secrets."
  type        = string
}

variable "image" {
  description = "Container image reference (registry/image:tag)."
  type        = string
}

variable "min_replicas" {
  description = "Minimum replicas (0 = scale-to-zero)."
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum replicas for autoscale."
  type        = number
  default     = 3
}

variable "target_port" {
  description = "Container port the app listens on."
  type        = number
  default     = 8000
}

# ── Azure OpenAI (created by this module) ───────────────────────────────────
# The endpoint is derived from azurerm_cognitive_account.openai; the
# deployment name is what we create here.  Both flow into the Container
# App's env vars as AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_MODEL.

variable "openai_account_name" {
  description = "Azure OpenAI (cognitive) account name. Becomes part of the endpoint URL: https://<name>.openai.azure.com/."
  type        = string
}

variable "openai_deployment_name" {
  description = "Name of the model deployment used by the Container App as AZURE_OPENAI_MODEL."
  type        = string
}

variable "openai_model_name" {
  description = "Model family (e.g. 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1')."
  type        = string
}

variable "openai_model_version" {
  description = "Specific model snapshot version (e.g. '2024-07-18' for gpt-4o-mini)."
  type        = string
}

variable "openai_tpm_capacity" {
  description = "Tokens-per-minute capacity in thousands (e.g. 5 = 5,000 TPM). Lower = stronger cost protection."
  type        = number
  default     = 5
}

variable "azure_openai_api_version" {
  description = "Azure OpenAI API version used by the backend (e.g. '2024-12-01-preview')."
  type        = string
}

# ── Azure OpenAI — classifier (intent routing) ───────────────────────────────
# A separate, smaller deployment used only by AgentRouter.classify().
# Kept distinct from the primary deployment so TPM limits don't interfere and
# the classifier model can be swapped independently of the chat model.

variable "openai_classify_deployment_name" {
  description = "Name of the classifier model deployment. Injected as AZURE_OPENAI_CLASSIFY_MODEL."
  type        = string
}

variable "openai_classify_model_name" {
  description = "Model family for the classifier (e.g. 'gpt-4.1-mini')."
  type        = string
}

variable "openai_classify_model_version" {
  description = "Model snapshot version for the classifier deployment."
  type        = string
}

variable "openai_classify_tpm_capacity" {
  description = "Tokens-per-minute capacity in thousands for the classifier deployment. Can be very low — the classifier emits at most 10 tokens per request."
  type        = number
  default     = 2
}

# ── Serper (LiveDataAgent web search tool) ───────────────────────────────────

variable "serper_api_key" {
  description = "Serper API key for the search_web tool (https://serper.dev). Sensitive — pass via tfvars or TF_VAR_serper_api_key; never commit. Leave empty to disable web search."
  type        = string
  sensitive   = true
  default     = ""
}

variable "tf_principal_object_id" {
  description = "Object ID of the principal running Terraform — granted Key Vault Secrets Officer so TF can write the OpenAI key. Pass data.azurerm_client_config.current.object_id."
  type        = string
}

variable "allowed_origins" {
  description = "Comma-separated origins allowed to call /api/*."
  type        = string
}

variable "github_actions_principal_id" {
  description = "Object ID of the GitHub Actions OIDC principal. Granted AcrPush + Container App Contributor. Empty string skips the role assignments."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}

variable "tenant_id" {
  description = "Azure AD tenant ID for Key Vault."
  type        = string
}

# ── App Insights (Award Nomination System — read-only metrics) ───────────────
# LogsQueryClient queries the Log Analytics *workspace*, not the App Insights
# component directly.  Both role assignments are required:
#   • App Insights component  — allows the UAMI to be recognised as a reader
#   • Log Analytics workspace — grants actual query execution rights (this is
#     the scope the SDK enforces at query time)

variable "app_insights_resource_id" {
  description = "Full resource ID of the Award Nomination System's Application Insights component. Grants Monitoring Reader at the component scope."
  type        = string
  default     = ""
}

variable "cosmos_endpoint" {
  description = "Cosmos DB account endpoint URL. Injected as AZURE_COSMOS_ENDPOINT. Leave empty to skip."
  type        = string
  default     = ""
}

variable "cosmos_database_name" {
  description = "Cosmos DB SQL database name. Injected as AZURE_COSMOS_DATABASE."
  type        = string
  default     = ""
}

variable "storage_blob_endpoint" {
  description = "Storage Account primary blob endpoint. Injected as AZURE_STORAGE_BLOB_ENDPOINT. Leave empty to skip."
  type        = string
  default     = ""
}

variable "storage_queue_endpoint" {
  description = "Storage Account primary queue endpoint. Injected as AZURE_STORAGE_QUEUE_ENDPOINT. Leave empty to skip."
  type        = string
  default     = ""
}

variable "engagement_intake_queue_name" {
  description = "Name of the Storage Queue for async engagement jobs. Injected as ENGAGEMENT_INTAKE_QUEUE_NAME."
  type        = string
  default     = "engagement-intake"
}

variable "engagement_assets_container_name" {
  description = "Blob container name for generated PPTX presentations. Injected as ENGAGEMENT_ASSETS_CONTAINER."
  type        = string
  default     = "engagement-assets"
}

variable "app_insights_log_analytics_resource_id" {
  description = "Full resource ID of the Log Analytics workspace that backs the App Insights instance (providers/Microsoft.OperationalInsights/workspaces/<name>). Grants Monitoring Reader at the workspace scope — required for LogsQueryClient to execute KQL queries."
  type        = string
  default     = ""
}

variable "app_insights_workspace_id" {
  description = "Log Analytics workspace ID (GUID) for the Award Nomination System App Insights instance. Injected into the Container App as APPINSIGHTS_WORKSPACE_ID so the metrics router can query it."
  type        = string
  default     = ""
}

# ── Gmail SMTP (contact form notifications) ──────────────────────────────────

variable "gmail_user" {
  description = "Gmail address used as the SMTP sender for contact form notification emails."
  type        = string
  default     = "david.terian@gmail.com"
}

variable "contact_notify_email" {
  description = "Destination inbox for contact form notifications. Defaults to gmail_user if empty."
  type        = string
  default     = ""
}

variable "gmail_app_password" {
  description = "Gmail App Password for SMTP auth. Sensitive — pass via TF_VAR_gmail_app_password or a GitHub Actions secret; never commit to disk. Leave empty to disable email notifications."
  type        = string
  sensitive   = true
  default     = ""
}

# ── Award Nomination compute + database resource IDs ─────────────────────────

variable "award_aca_primary_resource_id" {
  description = "ARM resource ID of the Award Nomination primary ACA. Grants Monitoring Reader so the backend can query replica-count metrics."
  type        = string
  default     = ""
}

variable "award_aca_secondary_resource_id" {
  description = "ARM resource ID of the Award Nomination secondary ACA. Grants Monitoring Reader so the backend can query replica-count metrics."
  type        = string
  default     = ""
}

variable "award_sql_db_resource_id" {
  description = "ARM resource ID of the Award Nomination SQL database. Grants Monitoring Reader so the backend can query storage metrics."
  type        = string
  default     = ""
}

variable "award_appi_frontend_resource_id" {
  description = "ARM resource ID of the Award Nomination *frontend* Application Insights component (appi-award-frontend-sandbox). Grants Monitoring Reader so the backend can query pageViews KQL against this resource. Leave empty to fall back to the backend App Insights resource."
  type        = string
  default     = ""
}

variable "award_appi_frontend_log_analytics_resource_id" {
  description = "ARM resource ID of the Log Analytics workspace backing the frontend App Insights component. Grants Monitoring Reader at the workspace scope — required for LogsQueryClient to execute KQL queries."
  type        = string
  default     = ""
}
