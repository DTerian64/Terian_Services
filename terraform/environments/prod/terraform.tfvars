# terraform.tfvars — prod environment
# ─────────────────────────────────────────────────────────────────────────────
# Actual values for variables whose defaults are wrong or empty for prod.
# Everything not listed here falls back to the default in variables.tf.
#
# ⚠  Do NOT commit secrets (keys, tokens, passwords) into this file.
#    Secrets are managed in Key Vault and never appear here.
# ─────────────────────────────────────────────────────────────────────────────

# ── DNS — SWA apex domain verification ──────────────────────────────────────
# Token from: Azure Portal → Static Web Apps → terian-services-frontend →
#             Custom domains → terian-services.com → Verification token
# Required to keep the asuid TXT record alive (removes it if left empty).

swa_verification_token = "_85841r7fomw0t6m7orfn8l2gtb0mohk"

# ── DevOps — GitHub Actions principal ────────────────────────────────────────
# Object ID of the GHA OIDC service principal.
# Grants: ACR Contributor (for az acr build) + ACA Contributor (for image rollout).

github_actions_principal_id = "dbbfce6e-5ae5-4337-8741-03cbb821cf0a"

# ── App Insights (Award Nomination System — read-only metrics) ───────────────

app_insights_resource_id = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/microsoft.insights/components/appi-award-api-sandbox"

app_insights_workspace_id = "fd6f9a14-55e5-4df1-8d38-213f826b962a"

app_insights_log_analytics_resource_id = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.OperationalInsights/workspaces/workspace-award-primary-sandbox"

# ── Award Nomination compute + database (Azure Monitor metrics) ───────────────

award_aca_primary_resource_id   = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.App/containerApps/award-api-primary-sandbox"
award_aca_secondary_resource_id = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.App/containerApps/award-api-secondary-sandbox"
award_sql_db_resource_id        = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_award_nomination_sandbox/providers/Microsoft.Sql/servers/david64-sql-sandbox/databases/AwardNominationsSandbox"

# Admin user — david64.terian@terian-services.com
# Storage Blob Data Contributor + Cosmos DB Built-in Data Contributor
admin_principal_id = "3790e0a2-8fe4-4595-9173-a9f1e18c5ae2"
