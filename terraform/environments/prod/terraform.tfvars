# environments/prod/terraform.tfvars
# ─────────────────────────────────────────────────────────────────────────────
# Two-phase apply process
# ─────────────────────────────────────────────────────────────────────────────
#
# Phase 1 — create the SWA (leave swa_verification_token blank):
#   terraform apply -target=module.static_web_app
#
# Retrieve the verification token:
#   az staticwebapp hostname set \
#     --name terian-services-frontend \
#     --resource-group rg_platform \
#     --hostname terian-services.com \
#     --validation-method dns-txt-token
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
swa_verification_token    = "_85841r7fomw0t6m7orfn8l2gtb0mohk"
