# modules/data-store/outputs.tf

output "storage_account_id" {
  description = "Storage Account resource ID — used to scope role assignments."
  value       = azurerm_storage_account.media.id
}

output "storage_account_name" {
  description = "Storage Account name."
  value       = azurerm_storage_account.media.name
}

output "storage_blob_endpoint" {
  description = "Primary blob service endpoint (e.g. https://stterianservices.blob.core.windows.net/)."
  value       = azurerm_storage_account.media.primary_blob_endpoint
}

output "team_photos_container_name" {
  description = "Blob container name for team/employee photos."
  value       = azurerm_storage_container.team_photos.name
}

output "cosmos_account_id" {
  description = "Cosmos DB account resource ID — used to scope role assignments."
  value       = azurerm_cosmosdb_account.main.id
}

output "cosmos_account_name" {
  description = "Cosmos DB account name."
  value       = azurerm_cosmosdb_account.main.name
}

output "cosmos_endpoint" {
  description = "Cosmos DB account endpoint URL — injected into the backend as AZURE_COSMOS_ENDPOINT."
  value       = azurerm_cosmosdb_account.main.endpoint
}

output "cosmos_database_name" {
  description = "Cosmos DB SQL database name."
  value       = azurerm_cosmosdb_sql_database.main.name
}

output "storage_queue_endpoint" {
  description = "Primary queue service endpoint (e.g. https://stterianservices.queue.core.windows.net/) — injected into the backend as AZURE_STORAGE_QUEUE_ENDPOINT."
  value       = azurerm_storage_account.media.primary_queue_endpoint
}

output "engagement_intake_queue_name" {
  description = "Name of the Storage Queue used for async engagement jobs — injected into the backend as ENGAGEMENT_INTAKE_QUEUE_NAME."
  value       = azurerm_storage_queue.engagement_intake.name
}

output "engagement_assets_container_name" {
  description = "Blob container name for generated PPTX presentations — injected into the backend as ENGAGEMENT_ASSETS_CONTAINER."
  value       = azurerm_storage_container.engagement_assets.name
}
