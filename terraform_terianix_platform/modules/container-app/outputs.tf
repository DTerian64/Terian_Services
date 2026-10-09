# modules/container-app/outputs.tf

output "container_app_id" {
  description = "Container App resource ID."
  value       = azurerm_container_app.backend.id
}

output "container_app_name" {
  description = "Container App resource name."
  value       = azurerm_container_app.backend.name
}

output "container_app_fqdn" {
  description = "Container App stable ingress hostname — e.g. terian-services-backend.<env>.eastus2.azurecontainerapps.io"
  value       = azurerm_container_app.backend.ingress[0].fqdn
}

output "container_app_environment_id" {
  description = "Container App Environment ID (reusable for additional apps in this RG)."
  value       = azurerm_container_app_environment.env.id
}

output "acr_login_server" {
  description = "ACR login server (e.g. acrterianservices.azurecr.io). Used by `az acr build`."
  value       = azurerm_container_registry.acr.login_server
}

output "acr_name" {
  description = "ACR resource name."
  value       = azurerm_container_registry.acr.name
}

output "uami_id" {
  description = "User-assigned managed identity resource ID."
  value       = azurerm_user_assigned_identity.backend.id
}

output "uami_principal_id" {
  description = "UAMI principal (object) ID — for additional role assignments."
  value       = azurerm_user_assigned_identity.backend.principal_id
}

output "uami_client_id" {
  description = "UAMI client ID — useful for Key Vault references that resolve via the identity."
  value       = azurerm_user_assigned_identity.backend.client_id
}

output "key_vault_id" {
  description = "Key Vault resource ID."
  value       = azurerm_key_vault.kv.id
}

output "key_vault_name" {
  description = "Key Vault name (use for `az keyvault secret set --vault-name ...`)."
  value       = azurerm_key_vault.kv.name
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID."
  value       = azurerm_log_analytics_workspace.logs.id
}

# ── Azure OpenAI ────────────────────────────────────────────────────────────
output "openai_account_name" {
  description = "Azure OpenAI cognitive account name."
  value       = azurerm_cognitive_account.openai.name
}

output "openai_endpoint" {
  description = "Azure OpenAI endpoint URL (wired into the Container App as AZURE_OPENAI_ENDPOINT)."
  value       = azurerm_cognitive_account.openai.endpoint
}

output "openai_deployment_name" {
  description = "Model deployment name (wired into the Container App as AZURE_OPENAI_MODEL)."
  value       = azurerm_cognitive_deployment.gpt.name
}
