# environments/prod/terraform.tfvars
# ─────────────────────────────────────────────────────────────────────────────
# Two-phase apply process
# ─────────────────────────────────────────────────────────────────────────────
#
# Phase 1 — create the SWA (leave swa_verification_token blank):
#   terraform apply -target=module.static_web_app
#
# Retrieve the verification token:
#   az staticwebapp show \
#     --name terian-services-frontend \
#     --resource-group rg_platform \
#     --query "customDomainVerificationId" -o tsv
#
# Phase 2 — fill in swa_verification_token below, then:
#   terraform apply
#
# ─────────────────────────────────────────────────────────────────────────────

resource_group_name = "rg_platform"
location            = "eastus2"
swa_name            = "terian-services-frontend"
dns_zone_name       = "terian-services.com"

# SWA domain verification — fill in after Phase 1 apply
swa_verification_dns_name = "asuid"
swa_verification_token    = ""   # <-- paste token here before Phase 2 apply
