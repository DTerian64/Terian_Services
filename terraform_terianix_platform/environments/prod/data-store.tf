module "data_store" {
  source = "../../modules/data-store"

  resource_group_name  = azurerm_resource_group.corporate.name
  location             = var.location
  storage_account_name = var.storage_account_name
  cosmos_account_name  = var.cosmos_account_name
  cosmos_database_name = var.cosmos_database_name
  tags                 = local.tags
}

resource "azurerm_role_assignment" "uami_blob_contributor" {
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = module.container_app.uami_principal_id
}

resource "azurerm_role_assignment" "uami_blob_delegator" {
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Blob Delegator"
  principal_id         = module.container_app.uami_principal_id
}

resource "azurerm_role_assignment" "uami_queue_contributor" {
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = module.container_app.uami_principal_id
}

resource "azurerm_cosmosdb_sql_role_assignment" "uami_cosmos_contributor" {
  resource_group_name = azurerm_resource_group.corporate.name
  account_name        = module.data_store.cosmos_account_name
  role_definition_id  = "${module.data_store.cosmos_account_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = module.container_app.uami_principal_id
  scope               = module.data_store.cosmos_account_id
}

resource "azurerm_role_assignment" "github_blob_contributor" {
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.github_actions.principal_id
}

resource "azurerm_role_assignment" "admin_blob_contributor" {
  count                = var.admin_principal_id == "" ? 0 : 1
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.admin_principal_id
}

resource "azurerm_cosmosdb_sql_role_assignment" "admin_cosmos_contributor" {
  count               = var.admin_principal_id == "" ? 0 : 1
  resource_group_name = azurerm_resource_group.corporate.name
  account_name        = module.data_store.cosmos_account_name
  role_definition_id  = "${module.data_store.cosmos_account_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = var.admin_principal_id
  scope               = module.data_store.cosmos_account_id
}
