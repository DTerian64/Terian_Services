# modules/container-app/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Backend hosting for terian-services.com — Azure Container Apps + supporting
# resources.
#
# Resources created:
#   - User-Assigned Managed Identity (UAMI)
#   - Azure Container Registry (Basic SKU)
#   - Log Analytics workspace
#   - Container App Environment
#   - Azure OpenAI account (S0) + a model deployment, dedicated to this site
#   - Key Vault (RBAC-auth) holding the OpenAI key
#   - Role assignments:
#       UAMI → AcrPull on the ACR (so the Container App can pull images)
#       UAMI → Key Vault Secrets User (so the Container App can read secrets)
#       TF principal → Key Vault Secrets Officer (so apply can write the key)
#   - (optional) GitHub Actions principal → AcrPush + Container App Contributor
#   - Container App with:
#       - UAMI attached for ACR pull and Key Vault secret refs
#       - HTTPS ingress on target_port (default 8000)
#       - CORS allowed_origins enforced at the app level
#       - Min/Max replicas — defaults to 0 / 3 (scale-to-zero)
#       - Env vars wired for the FastAPI app, including AZURE_OPENAI_KEY
#         pulled from Key Vault at runtime via the UAMI
#
# Notes:
#   - The OpenAI key never appears in plan output or in the Container App
#     resource — Terraform reads it off the cognitive account and writes it
#     straight into Key Vault; the Container App references it by name.
#   - Custom domain binding (api.terian-services.com) is deliberately not
#     included here — it requires the ACA-managed certificate flow which is
#     a separate, post-first-deploy step.  See the prod README block.
# ─────────────────────────────────────────────────────────────────────────────

# ── User-Assigned Managed Identity ──────────────────────────────────────────
resource "azurerm_user_assigned_identity" "backend" {
  name                = var.uami_name
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
}

# ── Azure Container Registry ────────────────────────────────────────────────
resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = var.tags
}

# UAMI → AcrPull (so the Container App can pull images)
resource "azurerm_role_assignment" "uami_acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# GitHub Actions principal → Contributor on ACR.
# AcrPush alone is insufficient for `az acr build`: that command schedules an
# ACR Task (control-plane) and requires registries/read + scheduleRun/action
# in addition to push/write. Contributor on the ACR scope covers all three
# without widening access beyond the registry resource.
resource "azurerm_role_assignment" "gha_acr_push" {
  count                = var.github_actions_principal_id == "" ? 0 : 1
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "Contributor"
  principal_id         = var.github_actions_principal_id
}

# ── Log Analytics workspace ─────────────────────────────────────────────────
resource "azurerm_log_analytics_workspace" "logs" {
  name                = var.log_analytics_workspace_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# ── Container App Environment ───────────────────────────────────────────────
resource "azurerm_container_app_environment" "env" {
  name                       = var.environment_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = var.tags
}

# ── Azure OpenAI account + deployment ──────────────────────────────────────
# Dedicated to the public-site bot.  Separate from the Award Nomination
# product's OpenAI endpoint so a traffic spike or key leak on the public
# side cannot affect authenticated enterprise customers.
resource "azurerm_cognitive_account" "openai" {
  name                  = var.openai_account_name
  location              = var.location
  resource_group_name   = var.resource_group_name
  kind                  = "OpenAI"
  sku_name              = "S0"
  custom_subdomain_name = var.openai_account_name
  tags                  = var.tags
}

resource "azurerm_cognitive_deployment" "gpt" {
  name                 = var.openai_deployment_name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = var.openai_model_name
    version = var.openai_model_version
  }

  # `GlobalStandard` = pay-per-token with global routing; required for the
  # GPT-4.1 model family (regional `Standard` SKU is not supported).
  # capacity is TPM in thousands; 5 = 5,000 TPM (caps a viral moment).
  # NOTE: azurerm 3.x uses a `scale` block here; azurerm 4.x renamed it
  # to `sku`. This module targets the 3.117 provider pinned in backend.tf.
  scale {
    type     = "GlobalStandard"
    capacity = var.openai_tpm_capacity
  }
}

# ── Key Vault (RBAC mode) ───────────────────────────────────────────────────
resource "azurerm_key_vault" "kv" {
  name                       = var.key_vault_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  purge_protection_enabled   = false
  soft_delete_retention_days = 7
  tags                       = var.tags
}

# UAMI → Key Vault Secrets User (read secret values)
resource "azurerm_role_assignment" "uami_kv_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# TF principal → Key Vault Secrets Officer (write secret values during apply).
# Required because the Key Vault is in RBAC mode and the creator doesn't get
# permissions automatically.
resource "azurerm_role_assignment" "tf_kv_secrets_officer" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.tf_principal_object_id
}

# RBAC role assignments take 30–60s to propagate.  Wait before writing the
# OpenAI key into the vault so the first apply doesn't 403.
resource "time_sleep" "kv_role_propagation" {
  depends_on      = [azurerm_role_assignment.tf_kv_secrets_officer]
  create_duration = "60s"
}

# ── OpenAI key → Key Vault secret ───────────────────────────────────────────
# Terraform reads the key off the cognitive account and writes it into the
# vault.  The Container App references it via secret name (below); the key
# value never appears in the Container App resource or in plan output.
resource "azurerm_key_vault_secret" "openai_key" {
  name         = "azure-openai-key"
  value        = azurerm_cognitive_account.openai.primary_access_key
  key_vault_id = azurerm_key_vault.kv.id

  depends_on = [
    time_sleep.kv_role_propagation,
  ]
}

# ── Gmail App Password → Key Vault secret ────────────────────────────────────
# Only created when gmail_app_password is supplied (count = 0 disables it).
# Pass the value as TF_VAR_gmail_app_password or a GitHub Actions secret —
# never commit it to terraform.tfvars.
resource "azurerm_key_vault_secret" "gmail_app_password" {
  count        = var.gmail_app_password != "" ? 1 : 0
  name         = "gmail-app-password"
  value        = var.gmail_app_password
  key_vault_id = azurerm_key_vault.kv.id

  depends_on = [
    time_sleep.kv_role_propagation,
  ]
}

# GitHub Actions principal → Contributor on the Container App (so the workflow
# can call `az containerapp update --image …` to roll a new revision).
# Scoped to the container app resource directly — the environment is a sibling
# under the RG, not a parent, so RBAC does not inherit from it.
resource "azurerm_role_assignment" "gha_aca_contributor" {
  count                = var.github_actions_principal_id == "" ? 0 : 1
  scope                = azurerm_container_app.backend.id
  role_definition_name = "Contributor"
  principal_id         = var.github_actions_principal_id
}

# UAMI → Monitoring Reader on the Award Nomination ACA primary (replica metrics).
resource "azurerm_role_assignment" "uami_aca_primary_reader" {
  count                = var.award_aca_primary_resource_id != "" ? 1 : 0
  scope                = var.award_aca_primary_resource_id
  role_definition_name = "Monitoring Reader"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# UAMI → Monitoring Reader on the Award Nomination ACA secondary (replica metrics).
resource "azurerm_role_assignment" "uami_aca_secondary_reader" {
  count                = var.award_aca_secondary_resource_id != "" ? 1 : 0
  scope                = var.award_aca_secondary_resource_id
  role_definition_name = "Monitoring Reader"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# UAMI → Monitoring Reader on the Award Nomination SQL database (storage metrics).
resource "azurerm_role_assignment" "uami_sql_db_reader" {
  count                = var.award_sql_db_resource_id != "" ? 1 : 0
  scope                = var.award_sql_db_resource_id
  role_definition_name = "Monitoring Reader"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# UAMI → Monitoring Reader on the App Insights component.
resource "azurerm_role_assignment" "uami_app_insights_reader" {
  count                = var.app_insights_resource_id != "" ? 1 : 0
  scope                = var.app_insights_resource_id
  role_definition_name = "Monitoring Reader"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# UAMI → Monitoring Reader on the backing Log Analytics workspace.
# LogsQueryClient enforces RBAC at the workspace scope — the App Insights
# component role alone is not sufficient to execute KQL queries.
resource "azurerm_role_assignment" "uami_log_analytics_reader" {
  count                = var.app_insights_log_analytics_resource_id != "" ? 1 : 0
  scope                = var.app_insights_log_analytics_resource_id
  role_definition_name = "Monitoring Reader"
  principal_id         = azurerm_user_assigned_identity.backend.principal_id
}

# ── Container App ───────────────────────────────────────────────────────────
resource "azurerm_container_app" "backend" {
  name                         = var.app_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.backend.id]
  }

  # ACR pull via UAMI — no admin user / no registry password stored
  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.backend.id
  }

  # AZURE_OPENAI_KEY — pulled from Key Vault via the UAMI at runtime.
  # versionless_id means the Container App always fetches the latest
  # version, so a key rotation doesn't require a Terraform change.
  secret {
    name                = "azure-openai-key"
    key_vault_secret_id = azurerm_key_vault_secret.openai_key.versionless_id
    identity            = azurerm_user_assigned_identity.backend.id
  }

  # GMAIL_APP_PASSWORD — only wired when the KV secret was created.
  dynamic "secret" {
    for_each = var.gmail_app_password != "" ? [1] : []
    content {
      name                = "gmail-app-password"
      key_vault_secret_id = azurerm_key_vault_secret.gmail_app_password[0].versionless_id
      identity            = azurerm_user_assigned_identity.backend.id
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "backend"
      image  = var.image
      cpu    = 0.5
      memory = "1Gi"

      # Endpoint and deployment name come straight from the OpenAI
      # resources this module creates — no hand-maintained values.
      env {
        name  = "AZURE_OPENAI_ENDPOINT"
        value = azurerm_cognitive_account.openai.endpoint
      }
      env {
        name  = "AZURE_OPENAI_MODEL"
        value = azurerm_cognitive_deployment.gpt.name
      }
      env {
        name  = "AZURE_OPENAI_API_VERSION"
        value = var.azure_openai_api_version
      }
      env {
        name        = "AZURE_OPENAI_KEY"
        secret_name = "azure-openai-key"
      }
      env {
        name  = "TERIAN_ALLOWED_ORIGINS"
        value = var.allowed_origins
      }
      # App Insights metrics — resource ID for KQL queries via query_resource();
      # client ID so DefaultAzureCredential picks the correct UAMI in ACA.
      env {
        name  = "APPINSIGHTS_RESOURCE_ID"
        value = var.app_insights_resource_id
      }
      env {
        name  = "AZURE_CLIENT_ID"
        value = azurerm_user_assigned_identity.backend.client_id
      }
      env {
        name  = "AZURE_COSMOS_ENDPOINT"
        value = var.cosmos_endpoint
      }
      env {
        name  = "AZURE_COSMOS_DATABASE"
        value = var.cosmos_database_name
      }
      env {
        name  = "AZURE_STORAGE_BLOB_ENDPOINT"
        value = var.storage_blob_endpoint
      }
      # Award Nomination compute + database resource IDs — for Azure Monitor metrics.
      env {
        name  = "AWARD_ACA_PRIMARY_RESOURCE_ID"
        value = var.award_aca_primary_resource_id
      }
      env {
        name  = "AWARD_ACA_SECONDARY_RESOURCE_ID"
        value = var.award_aca_secondary_resource_id
      }
      env {
        name  = "AWARD_SQL_DB_RESOURCE_ID"
        value = var.award_sql_db_resource_id
      }
      # Gmail SMTP — for contact form notification emails.
      env {
        name  = "GMAIL_USER"
        value = var.gmail_user
      }
      dynamic "env" {
        for_each = var.gmail_app_password != "" ? [1] : []
        content {
          name        = "GMAIL_APP_PASSWORD"
          secret_name = "gmail-app-password"
        }
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.target_port
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  # Image is updated out-of-band by GitHub Actions on each deploy.
  # Ignore drift on the `image` field so Terraform doesn't fight CI.
  lifecycle {
    ignore_changes = [
      template[0].container[0].image,
    ]
  }

  depends_on = [
    azurerm_role_assignment.uami_acr_pull,
    azurerm_role_assignment.uami_kv_secrets_user,
    azurerm_role_assignment.uami_app_insights_reader,
    azurerm_key_vault_secret.openai_key,
    azurerm_key_vault_secret.gmail_app_password,
    azurerm_cognitive_deployment.gpt,
  ]
}
