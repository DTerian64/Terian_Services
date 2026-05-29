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
  partition_key_paths = ["/email"]

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

# ── Engagement / Pricing data ─────────────────────────────────────────────────
# One document per product/service (e.g. "award-nomination", "integrity-sentinel").
# Partition key /service allows future cross-service queries if needed.

resource "azurerm_cosmosdb_sql_container" "engagement_details" {
  name                = "engagement_details"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/service"]

  default_ttl = -1
}

# ── Engagement intake — accounts & engagements ────────────────────────────────
# accounts: one document per registrant. Partition by /email so lookups by
# email address (login, de-dupe check) are single-partition reads.
#
# client_engagements: one document per engagement request, linked to an account
# via account_id. Partition by /account_id so listing all requests for a given
# account is a single-partition query. request_status drives the admin workflow:
# pending_review → contacted → proposal_sent → active | declined.

resource "azurerm_cosmosdb_sql_container" "accounts" {
  name                = "accounts"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/email"]

  default_ttl = -1
}

resource "azurerm_cosmosdb_sql_container" "client_engagements" {
  name                = "client_engagements"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/account_id"]

  default_ttl = -1
}

# ── Engagement worker dead-letter store ──────────────────────────────────────
# One document per job that exhausted all delivery attempts.
# The worker writes here and alerts sales@ so a human can follow up.
# Partition key /engagement_id keeps each failure self-contained.

resource "azurerm_cosmosdb_sql_container" "failed_engagement_jobs" {
  name                = "failed_engagement_jobs"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/engagement_id"]

  default_ttl = -1
}

# ── Email templates ───────────────────────────────────────────────────────────
# One document per email template, keyed by template_type.
# The backend reads the subject and html_body at send time so templates can be
# updated without a backend redeploy. Tokens ({{first_name}}, {{org_name}}, …)
# are substituted server-side before dispatch.
#
# Initial template_types:
#   "engagement_receive_confirmation" — internal notification to sales@
#   "welcome_to_terian_services"      — requester welcome / confirmation

resource "azurerm_cosmosdb_sql_container" "email_templates" {
  name                = "email_templates"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/template_type"]

  default_ttl = -1
}

# ── Engagement async worker infrastructure ────────────────────────────────────
# Storage Queue: engagement-intake
#   Producers: POST /api/accounts/register drops a message after CosmosDB write.
#   Consumer:  async worker polls, generates PPTX via LLM + python-pptx,
#              uploads to engagement-assets blob, sends Email #2 to requester.
#   Delivery guarantee: at-least-once via visibility timeouts (30 s default).
#   Dead-letter: worker writes a failed_engagement_jobs document to CosmosDB
#                and alerts sales@ if max retries are exhausted.

resource "azurerm_storage_queue" "engagement_intake" {
  name                 = "engagement-intake"
  storage_account_name = azurerm_storage_account.media.name
}

# Blob container for generated PPTX presentations.
# Always private — the backend UAMI writes here; Email #2 attaches the blob
# directly (downloaded server-side, not linked). No public access needed.
# Path convention: engagement-assets/{engagement_id}/onboarding.pptx

resource "azurerm_storage_container" "engagement_assets" {
  name                  = "engagement-assets"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "private"
}

# Blob container for reusable PPTX presentation templates.
# Always private — the backend UAMI reads here; templates are downloaded
# server-side by generate_award_onboarding() (and future service methods)
# and personalised via token substitution before being sent to clients.
# Content is managed by the deploy-blob-templates GHA workflow, which
# uploads ./blob_templates/** on every push to main that touches that folder.
# Path convention: <service>_onboarding.pptx
#   e.g. award_nomination_onboarding.pptx

resource "azurerm_storage_container" "blob_templates" {
  name                  = "blob-templates"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "private"
}

# Blob container for contact form attachment files.
# Always private — written by the backend UAMI at request time; never served
# directly to the browser. The corresponding Cosmos DB document in
# client_communications stores metadata (name, type, size, blob_path) for
# each file; the actual bytes live here.
# Path convention: {contact_doc_id}/{filename}
# This lets you list all attachments for a submission with a single prefix query.

resource "azurerm_storage_container" "client_com_attachments" {
  name                  = "client-com-attachments"
  storage_account_name  = azurerm_storage_account.media.name
  container_access_type = "private"
}

