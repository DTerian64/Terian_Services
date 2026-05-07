# environments/prod/outputs.tf

output "swa_default_hostname" {
  description = "SWA default hostname (azurestaticapps.net)"
  value       = module.static_web_app.default_hostname
}

output "swa_api_key" {
  description = "SWA deployment token — store as GitHub secret TERIAN_SWA_DEPLOYMENT_TOKEN"
  value       = module.static_web_app.api_key
  sensitive   = true
}

output "swa_custom_domain" {
  description = "Custom domain binding for terian-services.com"
  value       = azurerm_static_web_app_custom_domain.apex.domain_name
}
