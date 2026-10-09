output "subscription_id" {
  value = var.subscription_id
}

output "tenant_id" {
  value = var.tenant_id
}

output "corporate_resource_group_name" {
  value = azurerm_resource_group.corporate.name
}

output "platform_resource_group_name" {
  value = data.azurerm_resource_group.platform.name
}

output "shadow_dns_name_servers" {
  description = "Do not delegate the domain to these servers until every required record has been copied and validated."
  value       = azurerm_dns_zone.terian_services.name_servers
}

output "container_app_name" {
  value = module.container_app.container_app_name
}

output "container_app_fqdn" {
  value = module.container_app.container_app_fqdn
}

output "container_registry_name" {
  value = module.container_app.acr_name
}

output "container_registry_login_server" {
  value = module.container_app.acr_login_server
}

output "backend_uami_principal_id" {
  value = module.container_app.uami_principal_id
}

output "github_actions_client_id" {
  description = "Set this as the AZURE_CLIENT_ID variable in the terianix-platform-prod GitHub Environment."
  value       = azurerm_user_assigned_identity.github_actions.client_id
}

output "github_actions_principal_id" {
  description = "Target-tenant object ID used for Azure RBAC role assignments."
  value       = azurerm_user_assigned_identity.github_actions.principal_id
}

output "storage_account_name" {
  value = module.data_store.storage_account_name
}

output "cosmos_account_name" {
  value = module.data_store.cosmos_account_name
}

output "terian_services_frontend_hostname" {
  value = module.terian_services_frontend.default_hostname
}

output "terianix_frontend_hostname" {
  value = module.terianix_frontend.default_hostname
}

output "terian_services_frontend_deployment_token" {
  value     = module.terian_services_frontend.api_key
  sensitive = true
}

output "terianix_frontend_deployment_token" {
  value     = module.terianix_frontend.api_key
  sensitive = true
}

