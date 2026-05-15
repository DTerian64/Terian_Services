# modules/data-store/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Persistent data layer for Terian Services:
#
#   Storage Account (stterianservices)
#     └── Blob container: team-photos   (private; UAMI reads via identity)
#
#   Cosmos DB account (terian-services-cosmos-db) — Serverless, SQL API
#     └── Database: terian-services
#           └── Container: employees   (partition key: /id)
#
# Access
#   Role assignments are intentionally kept in prod/main.tf rather than here
#   to avoid a circular dependency (container_app ↔ data_store). The UAMI
#   principal ID comes from module.container_app which in turn consumes outputs
#   from this module, so the assignments must live at the environment level.
#
# Notes
#   • Serverless Cosmos DB is single-region only. Add a failover location and
#     switch to Provisioned throughput if multi-region is ever required.
#   • The team-photos container is private. The backend generates short-lived
#     SAS URLs or uses the UAMI identity to serve photo URLs to the frontend.
# ─────────────────────────────────────────────────────────────────────────────

# ── Storage Account ──────────────────────────────────────────────────────────

resource "azurerm_storage_account" "media" {
  name                     = var.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  # Disable anonymous public access at the account level.
  # Individual containers can be opened later if needed (e.g. a public CDN).
  allow_nested_items_to_be_public = false

  tags = var.tags
}

# Blob container for team / employee photos
resource "azurerm_storage_container" "team_photos" {
  name                  = "team-photos"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "private"
}


# ── Cosmos DB account ────────────────────────────────────────────────────────

resource "azurerm_cosmosdb_account" "main" {
  name                = var.cosmos_account_name
  resource_group_name = var.resource_group_name
  location            = var.location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"   # SQL (Core) API

  # Serverless — pay per request unit, no minimum cost.
  # Switch to provisioned throughput if sustained high traffic is expected.
  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  # Serverless accounts support a single region only.
  geo_location {
    location          = var.location
    failover_priority = 0
  }

  # Disable key-based auth — the UAMI uses AAD RBAC only.
  local_authentication_disabled = true

  tags = var.tags
}

# ── Cosmos DB SQL database + containers ──────────────────────────────────────

resource "azurerm_cosmosdb_sql_database" "main" {
  name                = var.cosmos_database_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_sql_container" "employees" {
  name                = "employees"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/id"]

  # Keep documents indefinitely (no TTL).
  default_ttl = -1
}

