# A principal object ID is tenant-local. The legacy GitHub Actions principal
# cannot be reused in the Terianix tenant, so this root creates a dedicated
# target-tenant workload identity with secretless GitHub OIDC federation.
resource "azurerm_user_assigned_identity" "github_actions" {
  name                = var.github_actions_identity_name
  resource_group_name = azurerm_resource_group.corporate.name
  location            = var.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github_actions" {
  name                = "github-terianix-platform-prod"
  resource_group_name = azurerm_resource_group.corporate.name
  parent_id           = azurerm_user_assigned_identity.github_actions.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = "https://token.actions.githubusercontent.com"
  subject             = "repo:${var.github_repository}:environment:${var.github_environment}"
}

# Allow the new service principal to become visible to Azure RBAC before the
# downstream modules create its narrowly scoped role assignments.
resource "time_sleep" "github_identity_propagation" {
  depends_on      = [azurerm_federated_identity_credential.github_actions]
  create_duration = "30s"
}
