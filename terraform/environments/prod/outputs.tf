# environments/prod/outputs.tf

# ── Resource groups ─────────────────────────────────────────────────────────
output "corporate_resource_group_name" {
  description = "Resource group hosting all Terian Services compute."
  value       = azurerm_resource_group.corporate.name
}

# ── Frontend (SWA) ──────────────────────────────────────────────────────────
output "swa_default_hostname" {
  description = "SWA default hostname (azurestaticapps.net)."
  value       = module.static_web_app.default_hostname
}

output "swa_api_key" {
  description = "SWA deployment token — store as GitHub secret TERIAN_SWA_DEPLOYMENT_TOKEN."
  value       = module.static_web_app.api_key
  sensitive   = true
}

output "swa_custom_domain" {
  description = "Custom domain binding for terian-services.com."
  value       = azurerm_static_web_app_custom_domain.apex.domain_name
}

# ── Backend (ACA) ───────────────────────────────────────────────────────────
output "backend_fqdn" {
  description = "Container App FQDN. Point the SPA's VITE_API_URL at https://<this>."
  value       = module.container_app.container_app_fqdn
}

output "backend_app_name" {
  description = "Container App name (used by deploy-backend.yml)."
  value       = module.container_app.container_app_name
}

output "acr_login_server" {
  description = "ACR login server (e.g. acrterianservices.azurecr.io) — used by `az acr build`."
  value       = module.container_app.acr_login_server
}

output "acr_name" {
  description = "ACR name (used by deploy-backend.yml)."
  value       = module.container_app.acr_name
}

output "key_vault_name" {
  description = "Key Vault name — store backend secrets here."
  value       = module.container_app.key_vault_name
}

output "uami_client_id" {
  description = "UAMI client ID — needed for Key Vault secret references in the Container App."
  value       = module.container_app.uami_client_id
}

# ── Azure OpenAI ────────────────────────────────────────────────────────────
output "openai_endpoint" {
  description = "Azure OpenAI endpoint URL provisioned for the public-site bot."
  value       = module.container_app.openai_endpoint
}

output "openai_deployment_name" {
  description = "OpenAI model deployment name (the backend's AZURE_OPENAI_MODEL)."
  value       = module.container_app.openai_deployment_name
}

# ── Frontend telemetry ───────────────────────────────────────────────────────
output "frontend_appinsights_connection_string" {
  description = "App Insights connection string — add as GitHub Actions variable VITE_APPINSIGHTS_CONNECTION_STRING."
  value       = azurerm_application_insights.frontend.connection_string
  sensitive   = true
}
