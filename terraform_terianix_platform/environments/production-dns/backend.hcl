resource_group_name  = "rg_terianix_platform"
storage_account_name = "stterianixtfstate"
container_name       = "tfstate"
# Preserve the earlier apex root's key so renaming its folder cannot fork state.
key                  = "terian-services/authoritative-dns/terraform.tfstate"
subscription_id      = "2bb69129-5e74-44d9-af68-96d45633f667"
tenant_id            = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
use_azuread_auth      = true
