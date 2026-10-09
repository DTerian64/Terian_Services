data "azurerm_client_config" "current" {}

locals {
  tags = {
    environment  = "prod"
    project      = "terian-services"
    platform     = "terianix"
    managed_by   = "terraform"
    migration_id = "terianix-platform"
  }
}

check "authenticated_subscription" {
  assert {
    condition     = data.azurerm_client_config.current.subscription_id == var.subscription_id
    error_message = "Azure authentication is not using the Terianix Platform subscription."
  }

  assert {
    condition     = data.azurerm_client_config.current.tenant_id == var.tenant_id
    error_message = "Azure authentication is not using the Terianix Platform tenant."
  }
}

# Target replacement for legacy rg_corporate.
resource "azurerm_resource_group" "corporate" {
  name     = var.corporate_resource_group_name
  location = var.location
  tags     = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

