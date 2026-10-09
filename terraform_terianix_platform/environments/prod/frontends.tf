module "terian_services_frontend" {
  source = "../../modules/static-web-app"

  resource_group_name = azurerm_resource_group.corporate.name
  location            = var.location
  app_name            = var.terian_services_swa_name
  tags                = local.tags

  app_settings = {
    VITE_API_URL = "https://${module.container_app.container_app_fqdn}"
  }
}

module "terianix_frontend" {
  source = "../../modules/static-web-app"

  resource_group_name = azurerm_resource_group.corporate.name
  location            = var.location
  app_name            = var.terianix_swa_name
  tags                = merge(local.tags, { brand = "terianix" })

  app_settings = {
    VITE_API_URL = "https://${module.container_app.container_app_fqdn}"
  }
}
