# modules/data-store/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Persistent data layer for Terian Services:
#
#   Storage Account (stterianservices)
#     ├── Blob container: team-photos   (public blob read; images served directly to frontend)
#     └── Blob container: ai-prompts    (private; agent prompt.md files read by backend UAMI)
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

  # Allow public blob access at the account level so the team-photos
  # container can serve images directly to the frontend without SAS tokens.
  allow_nested_items_to_be_public = true

  tags = var.tags
}

# Blob container for team / employee photos
resource "azurerm_storage_container" "team_photos" {
  name                  = "team-photos"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "blob"   # public read for blobs; no container listing
}

# Blob container for AI agent prompt files (base, company_info, product, web_search)
# Always private — the backend reads these via the UAMI (Storage Blob Data Reader).
# The GitHub Actions deploy-prompts workflow writes here via Storage Blob Data Contributor.
# Source of truth: ai_prompts/<skill>/prompt.md in this repo.
resource "azurerm_storage_container" "ai_prompts" {
  name                  = "ai-prompts"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "private"
}

# Blob container for Ask AI file attachments (images, PDFs, Word docs, CSVs).
# Always private — written by the backend UAMI at request time; never served
# directly to the browser.
# Path convention: {conversation_id}/{timestamp_ms}.{ext}
# This lets you list all attachments for a conversation with a single prefix query.
resource "azurerm_storage_container" "ai_attachments" {
  name                  = "ai-attachments"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "private"
}

# Blob container for public legal template PDFs (MSA, NDA, SaaS Subscription Agreement).
# container_access_type = "blob" allows anonymous GET on individual blobs
# (no container listing) — right for documents intentionally published to prospects.
# The GitHub Actions deploy-legal-templates workflow in Terian_Services_Legal writes here.
# Source of truth: Legal/Templates/Customer/*.docx in the Terian_Services_Legal repo.
resource "azurerm_storage_container" "legal_templates" {
  name                  = "legal-templates"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "blob"   # public read for blobs; no container listing
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

resource "azurerm_cosmosdb_sql_container" "client_communications" {
  name                = "client_communications"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/id"]

  # Keep contact submissions indefinitely (no TTL).
  default_ttl = -1
}

# ── Ask AI conversation storage ───────────────────────────────────────────────
# Two containers mirror the Award Nomination AskConversations / AskMessages
# pattern, adapted for anonymous visitors (visitor_id replaces UserId+TenantId).

resource "azurerm_cosmosdb_sql_container" "ai_conversations" {
  name                = "ai_conversations"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  # Partition by visitor so listing a user's conversations is a single-partition query.
  partition_key_paths = ["/visitor_id"]

  default_ttl = -1
}

resource "azurerm_cosmosdb_sql_container" "ai_messages" {
  name                = "ai_messages"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  # Partition by conversation so loading all messages is a single-partition query.
  partition_key_paths = ["/conversation_id"]

  default_ttl = -1
}

