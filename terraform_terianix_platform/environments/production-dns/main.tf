# Production website DNS for terian-services.com (Azure) and terianix.ai
# (Cloudflare). Scope is the four apex/www records, not either entire zone.
# Application resources and Azure custom-domain bindings stay in ../prod.
# See README.md for imports, state ownership, and operator-only cloud steps.
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.116"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id            = "4ddf12bb-5397-445f-bcaa-df4c7d3dfdca"
  tenant_id                  = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
  skip_provider_registration = true
}

provider "azurerm" {
  alias = "platform"
  features {}
  subscription_id            = "2bb69129-5e74-44d9-af68-96d45633f667"
  tenant_id                  = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
  skip_provider_registration = true
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

data "azurerm_dns_zone" "authoritative" {
  name                = "terian-services.com"
  resource_group_name = "rg_platform"
}

# Read the application resources; their lifecycle remains in ../prod.
data "azurerm_static_web_app" "frontend" {
  provider            = azurerm.platform
  name                = "terian-services-frontend-platform"
  resource_group_name = "rg_terian_services_prod"
}

data "azurerm_static_web_app" "terianix_frontend" {
  provider            = azurerm.platform
  name                = "terianix-frontend-platform"
  resource_group_name = "rg_terian_services_prod"
}
