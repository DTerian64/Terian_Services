module "container_app" {
  source = "../../modules/container-app"

  resource_group_name    = azurerm_resource_group.corporate.name
  location               = var.location
  tenant_id              = var.tenant_id
  tf_principal_object_id = data.azurerm_client_config.current.object_id

  app_name                     = var.aca_app_name
  environment_name             = var.aca_environment_name
  uami_name                    = var.aca_uami_name
  acr_name                     = var.acr_name
  log_analytics_workspace_name = var.log_analytics_workspace_name
  key_vault_name               = var.key_vault_name

  image        = var.backend_image
  min_replicas = var.backend_min_replicas
  max_replicas = var.backend_max_replicas

  openai_account_name             = var.openai_account_name
  openai_deployment_name          = var.openai_deployment_name
  openai_model_name               = var.openai_model_name
  openai_model_version            = var.openai_model_version
  openai_tpm_capacity             = var.openai_tpm_capacity
  openai_classify_deployment_name = var.openai_classify_deployment_name
  openai_classify_model_name      = var.openai_classify_model_name
  openai_classify_model_version   = var.openai_classify_model_version
  openai_classify_tpm_capacity    = var.openai_classify_tpm_capacity
  azure_openai_api_version        = var.azure_openai_api_version

  serper_api_key = var.serper_api_key
  allowed_origins = join(",", distinct(concat(
    split(",", var.backend_allowed_origins), var.pre_cutover_frontend_origins
  )))
  smtp_user            = var.smtp_user
  smtp_host            = var.smtp_host
  smtp_port            = var.smtp_port
  smtp_password        = var.smtp_password
  contact_notify_email = var.contact_notify_email

  github_actions_enabled      = true
  github_actions_principal_id = azurerm_user_assigned_identity.github_actions.principal_id

  app_insights_resource_id                      = var.app_insights_resource_id
  app_insights_log_analytics_resource_id        = var.app_insights_log_analytics_resource_id
  app_insights_workspace_id                     = var.app_insights_workspace_id
  award_aca_primary_resource_id                 = var.award_aca_primary_resource_id
  award_aca_secondary_resource_id               = var.award_aca_secondary_resource_id
  award_sql_db_resource_id                      = var.award_sql_db_resource_id
  award_appi_frontend_resource_id               = var.award_appi_frontend_resource_id
  award_appi_frontend_log_analytics_resource_id = var.award_appi_frontend_log_analytics_resource_id

  cosmos_endpoint                  = module.data_store.cosmos_endpoint
  cosmos_database_name             = module.data_store.cosmos_database_name
  storage_blob_endpoint            = module.data_store.storage_blob_endpoint
  storage_queue_endpoint           = module.data_store.storage_queue_endpoint
  engagement_intake_queue_name     = module.data_store.engagement_intake_queue_name
  engagement_assets_container_name = module.data_store.engagement_assets_container_name

  tags = local.tags

  depends_on = [time_sleep.github_identity_propagation]
}
