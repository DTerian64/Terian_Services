# environments/prod/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Terian Services — terian-services.com (prod)
#
# Two resource groups:
#   • rg_platform   (pre-existing, owned elsewhere) — DNS zone + TF state SA
#   • rg_corporate  (created here)                  — all Terian compute
#
# Resources managed here:
#   - rg_corporate Resource Group
#   - Azure Static Web App (frontend)                — in rg_corporate
#   - Container App + ACR + Key Vault + Log Analytics + UAMI (backend)
#                                                    — in rg_corporate
#   - DNS records for SWA verification + binding     — in rg_platform's zone
#   - SWA custom domain bindings (apex + www)        — bound to the SWA above
#
# Resources NOT managed here:
#   - rg_platform itself
#   - terian-services.com App Service Domain + DNS zone (both in rg_platform)
#   - awardnomplatform storage account (used for Terraform state)
#
# ── Migration note (one-time) ────────────────────────────────────────────────
# The existing `terian-services-frontend` SWA lives in rg_platform.  To move
# it to rg_corporate without recreating the resource (which would invalidate
# the deployment token and trigger DNS revalidation):
#
#   1. terraform apply -target=azurerm_resource_group.corporate
#      (creates rg_corporate without touching anything else)
#
#   2. az resource move \
#        --destination-group rg_corporate \
#        --ids $(az staticwebapp show \
#                  --name terian-services-frontend \
#                  --resource-group rg_platform \
#                  --query id -o tsv)
#
#   3. terraform state rm module.static_web_app.azurerm_static_web_app.site \
#        azurerm_static_web_app_custom_domain.apex \
#        azurerm_static_web_app_custom_domain.www
#
#   4. terraform import module.static_web_app.azurerm_static_web_app.site \
#        $(az staticwebapp show --name terian-services-frontend \
#                                --resource-group rg_corporate --query id -o tsv)
#
#      terraform import azurerm_static_web_app_custom_domain.apex \
#        "<swa-id-in-rg_corporate>/customDomains/terian-services.com"
#      terraform import azurerm_static_web_app_custom_domain.www \
#        "<swa-id-in-rg_corporate>/customDomains/www.terian-services.com"
#
#   5. terraform plan      # should now show no changes for the SWA
#   6. terraform apply     # creates ACR + ACA + Key Vault + ... in rg_corporate
# ─────────────────────────────────────────────────────────────────────────────

data "azurerm_client_config" "current" {}

locals {
  tags = {
    environment = "prod"
    project     = "terian-services"
    managed_by  = "terraform"
  }
}

# ── 0. Resource groups ───────────────────────────────────────────────────────

# Created by this Terraform — every Terian Services compute resource lives here.
resource "azurerm_resource_group" "corporate" {
  name     = var.corporate_resource_group_name
  location = var.location
  tags     = local.tags
}

# Read existing rg_platform (DNS zone + TF state SA live here).
data "azurerm_resource_group" "platform" {
  name = var.dns_resource_group_name
}

# ── 1. DNS zone (read-only — managed elsewhere in rg_platform) ──────────────
data "azurerm_dns_zone" "terian" {
  name                = var.dns_zone_name
  resource_group_name = var.dns_resource_group_name
}

# ── 2. Static Web App (frontend) — stays in rg_platform for now ─────────────
# Cross-RG move is deferred (Phase 2 of the migration runbook) because the
# `az resource move` is blocked by the apex custom-domain binding, and
# fixing that binding requires a planned ~15–30 minute apex-HTTPS outage.
# Until then, the SWA's resource group is sourced from var.swa_resource_group_name
# (defaults to rg_platform). When ready to move, flip the variable to
# var.corporate_resource_group_name AND follow the runbook's state-rm + import
# dance so Terraform doesn't propose to destroy and recreate the SWA.
module "static_web_app" {
  source = "../../modules/static-web-app"

  resource_group_name = var.swa_resource_group_name
  location            = var.location
  app_name            = var.swa_name
  tags                = local.tags

  # VITE_API_URL is consumed by the SWA build step so the frontend bundle
  # knows where the backend API lives.  Derived from the Container App's
  # stable ingress hostname — no hard-coded URL needed here.
  app_settings = {
    VITE_API_URL = "https://${module.container_app.container_app_fqdn}"
  }

  depends_on = [module.container_app]
}

# ── 3. DNS — CNAME: www → SWA default hostname (record lives in rg_platform) ─
resource "azurerm_dns_cname_record" "www" {
  name                = "www"
  zone_name           = data.azurerm_dns_zone.terian.name
  resource_group_name = var.dns_resource_group_name
  ttl                 = 300
  record              = module.static_web_app.default_hostname
  tags                = local.tags
}

# ── 4. DNS — TXT record for apex domain ownership verification ──────────────
# Only created when swa_verification_token is set.  The token comes from the
# SWA portal after the first apply; once the apex custom-domain binding has
# been verified and the cert is Active, the record can stay or be removed —
# Azure doesn't re-check it after initial issuance.  Leaving the variable
# empty (the default) skips the record without breaking the plan.
resource "azurerm_dns_txt_record" "swa_verify" {
  count               = var.swa_verification_token != "" ? 1 : 0
  name                = var.swa_verification_dns_name
  zone_name           = data.azurerm_dns_zone.terian.name
  resource_group_name = var.dns_resource_group_name
  ttl                 = 300

  record {
    value = var.swa_verification_token
  }

  tags = local.tags
}

# ── 4a. DNS — apex A record (ALIAS to the SWA) ──────────────────────────────
# The TXT record above proves ownership.  This ALIAS A record provides actual
# resolution so:
#   - browsers can reach the SWA when they hit https://terian-services.com
#   - Let's Encrypt can reach the apex during managed-cert issuance (without
#     it, the apex binding sits in `Validating` forever and the cert never
#     issues)
# Azure DNS resolves target_resource_id to the SWA's current IP automatically
# and follows the resource if the IP ever changes — better than a static A
# record.
resource "azurerm_dns_a_record" "apex_alias" {
  name                = "@"
  zone_name           = data.azurerm_dns_zone.terian.name
  resource_group_name = var.dns_resource_group_name
  ttl                 = 300
  target_resource_id  = module.static_web_app.static_web_app_id
  tags                = local.tags
}

# ── 5. SWA custom domain bindings ───────────────────────────────────────────
resource "azurerm_static_web_app_custom_domain" "apex" {
  static_web_app_id = module.static_web_app.static_web_app_id
  domain_name       = var.dns_zone_name
  validation_type   = "dns-txt-token"

  depends_on = [
    azurerm_dns_txt_record.swa_verify,  # empty list when token unset — harmless
    azurerm_dns_a_record.apex_alias,
    azurerm_dns_cname_record.www,
  ]
}

resource "azurerm_static_web_app_custom_domain" "www" {
  static_web_app_id = module.static_web_app.static_web_app_id
  domain_name       = "www.${var.dns_zone_name}"
  validation_type   = "cname-delegation"

  depends_on = [
    azurerm_dns_cname_record.www,
    azurerm_static_web_app_custom_domain.apex,
  ]
}

# ── 6. Data store — Storage Account + Cosmos DB ─────────────────────────────
module "data_store" {
  source = "../../modules/data-store"

  resource_group_name  = azurerm_resource_group.corporate.name
  location             = var.location
  storage_account_name = var.storage_account_name
  cosmos_account_name  = var.cosmos_account_name
  cosmos_database_name = var.cosmos_database_name
  tags                 = local.tags
}

# ── Data store role assignments ──────────────────────────────────────────────
# Kept here (not in the data-store module) to avoid a circular dependency:
# data_store outputs flow into container_app, so data_store must not depend
# on container_app's outputs (i.e. the UAMI principal ID).

resource "azurerm_role_assignment" "uami_blob_reader" {
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = module.container_app.uami_principal_id
}

resource "azurerm_cosmosdb_sql_role_assignment" "uami_cosmos_contributor" {
  resource_group_name = azurerm_resource_group.corporate.name
  account_name        = module.data_store.cosmos_account_name
  role_definition_id  = "${module.data_store.cosmos_account_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = module.container_app.uami_principal_id
  scope               = module.data_store.cosmos_account_id
}

# ── Admin user access (david64.terian@terian-services.com) ──────────────────

resource "azurerm_role_assignment" "admin_blob_contributor" {
  count                = var.admin_principal_id != "" ? 1 : 0
  scope                = module.data_store.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.admin_principal_id
}

resource "azurerm_cosmosdb_sql_role_assignment" "admin_cosmos_contributor" {
  count               = var.admin_principal_id != "" ? 1 : 0
  resource_group_name = azurerm_resource_group.corporate.name
  account_name        = module.data_store.cosmos_account_name
  role_definition_id  = "${module.data_store.cosmos_account_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = var.admin_principal_id
  scope               = module.data_store.cosmos_account_id
}

# ── 7. Container App (backend) — in rg_corporate ─────────────────────────────
module "container_app" {
  source = "../../modules/container-app"

  resource_group_name          = azurerm_resource_group.corporate.name
  location                     = var.location
  tenant_id                    = data.azurerm_client_config.current.tenant_id
  tf_principal_object_id       = data.azurerm_client_config.current.object_id

  app_name                     = var.aca_app_name
  environment_name             = var.aca_environment_name
  uami_name                    = var.aca_uami_name
  acr_name                     = var.acr_name
  log_analytics_workspace_name = var.log_analytics_workspace_name
  key_vault_name               = var.key_vault_name

  image                        = var.backend_image
  min_replicas                 = var.backend_min_replicas
  max_replicas                 = var.backend_max_replicas

  # Azure OpenAI — provisioned by the module, dedicated to the public site
  openai_account_name          = var.openai_account_name
  openai_deployment_name       = var.openai_deployment_name
  openai_model_name            = var.openai_model_name
  openai_model_version         = var.openai_model_version
  openai_tpm_capacity          = var.openai_tpm_capacity
  azure_openai_api_version     = var.azure_openai_api_version

  allowed_origins              = var.backend_allowed_origins

  github_actions_principal_id  = var.github_actions_principal_id

  # App Insights (Award Nomination System showcase metrics)
  app_insights_resource_id               = var.app_insights_resource_id
  app_insights_log_analytics_resource_id = var.app_insights_log_analytics_resource_id
  app_insights_workspace_id              = var.app_insights_workspace_id

  # Gmail SMTP (contact form notifications)
  gmail_user         = var.gmail_user
  gmail_app_password = var.gmail_app_password

  # Data store — Cosmos DB + Blob Storage
  cosmos_endpoint        = module.data_store.cosmos_endpoint
  cosmos_database_name   = module.data_store.cosmos_database_name
  storage_blob_endpoint  = module.data_store.storage_blob_endpoint

  tags = local.tags
}

# ── 8. Application Insights (frontend telemetry) ────────────────────────────
data "azurerm_log_analytics_workspace" "corporate" {
  name                = var.log_analytics_workspace_name
  resource_group_name = azurerm_resource_group.corporate.name
}

resource "azurerm_application_insights" "frontend" {
  name                = "appi-terian-services-frontend"
  resource_group_name = azurerm_resource_group.corporate.name
  location            = var.location
  workspace_id        = data.azurerm_log_analytics_workspace.corporate.id
  application_type    = "web"
  tags                = local.tags
}

# ── 7. Post-apply notes ─────────────────────────────────────────────────────
# Azure OpenAI is now fully provisioned by the container-app module — the
# account, the model deployment, the Key Vault secret holding the key, and
# the Container App env wiring are all created on `terraform apply`.  No
# manual `az keyvault secret set` step is needed.
#
# Remaining manual / future work:
#
#   1. (Optional) Bind the api.terian-services.com custom domain to the
#      Container App.  Requires a managed cert (provider 4.x) or an uploaded
#      cert.  Deferred until we switch the SPA from the default ACA hostname
#      to the custom one.
#
#   2. First-time Azure OpenAI quota: some subscriptions need quota approval
#      before a gpt-4o-mini deployment can be created.  If `terraform apply`
#      fails on azurerm_cognitive_deployment.gpt with an InsufficientQuota
#      error, request quota in the Azure AI Foundry portal and re-apply.
