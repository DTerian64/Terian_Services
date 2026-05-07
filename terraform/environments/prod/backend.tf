# environments/prod/backend.tf
# ─────────────────────────────────────────────────────────────────────────────
# Terraform state is stored in the existing awardnomplatform storage account
# in rg_platform — same account used for ML models in Award_Nomination_App,
# but a different key so state files don't collide.
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.116"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg_platform"
    storage_account_name = "awardnomplatform"
    container_name       = "tfstate"
    key                  = "terian-services/prod/terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}
