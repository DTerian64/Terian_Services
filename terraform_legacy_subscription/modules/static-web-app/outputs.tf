# modules/static-web-app/outputs.tf

output "static_web_app_id" {
  description = "Static Web App resource ID"
  value       = azurerm_static_web_app.site.id
}

output "default_hostname" {
  description = "Default SWA hostname — e.g. lemon-beach-abc123.azurestaticapps.net"
  value       = azurerm_static_web_app.site.default_host_name
}

output "api_key" {
  description = "Deployment token — add to GitHub repo secret TERIAN_SWA_DEPLOYMENT_TOKEN"
  value       = azurerm_static_web_app.site.api_key
  sensitive   = true
}

# ─────────────────────────────────────────────────────────────────────────────
# POST-DEPLOY: set the GitHub Actions deployment token
# ─────────────────────────────────────────────────────────────────────────────
#   terraform output -raw api_key
#
#   gh secret set TERIAN_SWA_DEPLOYMENT_TOKEN \
#     --repo DTerian64/David64_Award_Nominations \
#     --body "$(terraform output -raw api_key)"
# ─────────────────────────────────────────────────────────────────────────────
