resource "azurerm_application_insights" "terian_services_frontend" {
  name                = "appi-terian-services-frontend-prod"
  resource_group_name = azurerm_resource_group.corporate.name
  location            = var.location
  workspace_id        = module.container_app.log_analytics_workspace_id
  application_type    = "web"
  tags                = local.tags
}

resource "azurerm_application_insights" "terianix_frontend" {
  name                = "appi-terianix-frontend-prod"
  resource_group_name = azurerm_resource_group.corporate.name
  location            = var.location
  workspace_id        = module.container_app.log_analytics_workspace_id
  application_type    = "web"
  tags                = merge(local.tags, { brand = "terianix" })
}
