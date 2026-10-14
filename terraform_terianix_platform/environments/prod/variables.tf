variable "subscription_id" {
  description = "Terianix Platform Azure subscription ID."
  type        = string
  default     = "2bb69129-5e74-44d9-af68-96d45633f667"

  validation {
    condition     = var.subscription_id == "2bb69129-5e74-44d9-af68-96d45633f667"
    error_message = "This root may only target the Terianix Platform subscription."
  }
}

variable "tenant_id" {
  description = "Terianix Platform Microsoft Entra tenant ID."
  type        = string
  default     = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"

  validation {
    condition     = var.tenant_id == "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
    error_message = "This root may only target the Terianix Platform tenant."
  }
}

variable "location" {
  description = "Azure region for the Terian Services target stack."
  type        = string
  default     = "eastus2"
}

variable "corporate_resource_group_name" {
  description = "Target replacement for legacy rg_corporate."
  type        = string
  default     = "rg_terian_services_prod"
}

variable "platform_resource_group_name" {
  description = "Existing shared Terianix platform resource group used for approved platform-level Terian resources."
  type        = string
  default     = "rg_terianix_platform"

  validation {
    condition     = var.platform_resource_group_name == "rg_terianix_platform"
    error_message = "Platform-level resources for this root must target the existing rg_terianix_platform resource group."
  }
}

variable "dns_zone_name" {
  description = "Shadow Azure DNS zone prepared before registrar cutover."
  type        = string
  default     = "terian-services.com"
}

variable "storage_account_name" {
  description = "Globally unique target application storage account name."
  type        = string
  default     = "stterianixservicesprod"
}

variable "cosmos_account_name" {
  description = "Globally unique target Cosmos DB account name."
  type        = string
  default     = "terianix-services-prod"
}

variable "cosmos_database_name" {
  description = "Cosmos DB SQL database name retained from the legacy application."
  type        = string
  default     = "terian-services"
}

variable "aca_app_name" {
  type    = string
  default = "terian-services-backend-prod"
}

variable "aca_environment_name" {
  type    = string
  default = "cae-terian-services-prod"
}

variable "aca_uami_name" {
  type    = string
  default = "uami-terian-services-backend-prod"
}

variable "acr_name" {
  description = "Globally unique target Azure Container Registry name."
  type        = string
  default     = "acrterianixservices"
}

variable "log_analytics_workspace_name" {
  type    = string
  default = "law-terian-services-prod"
}

variable "key_vault_name" {
  description = "Globally unique target Key Vault name."
  type        = string
  default     = "kv-terianix-svc-prod"
}

variable "backend_image" {
  description = "Bootstrap image. CI replaces it with the application image after ACR is available."
  type        = string
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

variable "backend_min_replicas" {
  type    = number
  default = 0
}

variable "backend_max_replicas" {
  type    = number
  default = 3
}

variable "backend_allowed_origins" {
  description = "Comma-separated production browser origins."
  type        = string
  default     = "https://terian-services.com,https://www.terian-services.com,https://terianix.ai,https://www.terianix.ai"
}

variable "pre_cutover_frontend_origins" {
  description = "Exact Azure Static Web App origins allowed while testing the target deployment before domain cutover."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for origin in var.pre_cutover_frontend_origins :
      can(regex("^https://[a-z0-9.-]+\\.azurestaticapps\\.net$", origin))
    ])
    error_message = "Pre-cutover origins must be exact HTTPS Azure Static Web App origins, without a trailing slash."
  }
}

variable "openai_account_name" {
  description = "Globally unique target Azure OpenAI account name."
  type        = string
  default     = "oai-terianix-services-prod"
}

variable "openai_deployment_name" {
  type    = string
  default = "gpt-5.4-nano"
}

variable "openai_model_name" {
  type    = string
  default = "gpt-5.4-nano"
}

variable "openai_model_version" {
  type    = string
  default = "2026-03-17"
}

variable "openai_tpm_capacity" {
  type    = number
  default = 5
}

variable "openai_classify_deployment_name" {
  type    = string
  default = "gpt-4.1-mini"
}

variable "openai_classify_model_name" {
  type    = string
  default = "gpt-4.1-mini"
}

variable "openai_classify_model_version" {
  type    = string
  default = "2025-04-14"
}

variable "openai_classify_tpm_capacity" {
  type    = number
  default = 2
}

variable "azure_openai_api_version" {
  type    = string
  default = "2024-12-01-preview"
}

variable "terian_services_swa_name" {
  type    = string
  default = "terian-services-frontend-platform"
}

variable "terianix_swa_name" {
  type    = string
  default = "terianix-frontend-platform"
}

variable "github_actions_identity_name" {
  description = "Target-tenant user-assigned identity used by Terian Services GitHub Actions."
  type        = string
  default     = "uami-github-terian-services-prod"
}

variable "github_repository" {
  description = "GitHub owner/repository authorized to exchange an OIDC token."
  type        = string
  default     = "DTerian64/Terian_Services"

  validation {
    condition     = var.github_repository == "DTerian64/Terian_Services"
    error_message = "This production root is restricted to the DTerian64/Terian_Services repository."
  }
}

variable "github_environment" {
  description = "GitHub Environment authorized to deploy the target production stack."
  type        = string
  default     = "terianix-platform-prod"
}

variable "admin_principal_id" {
  description = "Optional target-tenant administrator object ID for data-plane access."
  type        = string
  default     = ""
}

variable "serper_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "smtp_host" {
  type    = string
  default = "smtppro.zoho.com"
}

variable "smtp_port" {
  description = "Zoho SMTP STARTTLS port."
  type        = number
  default     = 587

  validation {
    condition     = var.smtp_port >= 1 && var.smtp_port <= 65535
    error_message = "smtp_port must be between 1 and 65535."
  }
}

variable "smtp_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "contact_notify_email" {
  type    = string
  default = ""
}

variable "app_insights_resource_id" {
  description = "Target Award backend Application Insights resource ID."
  type        = string
  default     = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_award_nomination_sandbox/providers/microsoft.insights/components/appi-award-api-sandbox"
}

variable "app_insights_log_analytics_resource_id" {
  description = "Target shared Log Analytics workspace resource ID used by Award telemetry."
  type        = string
  default     = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_integrity_sentinel_sandbox/providers/Microsoft.OperationalInsights/workspaces/law-integritysentinel-sandbox"
}

variable "app_insights_workspace_id" {
  description = "Target shared Log Analytics customer/workspace GUID."
  type        = string
  default     = "2c61a2f7-306e-40db-82eb-4bee5a66aa1b"
}

variable "award_aca_primary_resource_id" {
  description = "The target platform has one Award backend Container App."
  type        = string
  default     = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.App/containerApps/award-api-sandbox"
}

variable "award_aca_secondary_resource_id" {
  description = "Intentionally empty because the target platform has no secondary Award backend Container App."
  type        = string
  default     = ""
}

variable "award_sql_db_resource_id" {
  type    = string
  default = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_integrity_sentinel_sandbox/providers/Microsoft.Sql/servers/sql-integritysentinel-sandbox/databases/AwardNominationsSandbox"
}

variable "award_appi_frontend_resource_id" {
  type    = string
  default = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_award_nomination_sandbox/providers/microsoft.insights/components/appi-award-frontend-sandbox"
}

variable "award_appi_frontend_log_analytics_resource_id" {
  type    = string
  default = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_integrity_sentinel_sandbox/providers/Microsoft.OperationalInsights/workspaces/law-integritysentinel-sandbox"
}

