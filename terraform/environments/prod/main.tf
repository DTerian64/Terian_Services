# environments/prod/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Terian Services website — terian-services.com
#
# Resources managed here:
#   - Azure Static Web App (Free SKU)
#   - DNS CNAME  → SWA default hostname
#   - DNS TXT    → SWA domain ownership verification
#   - SWA custom domain binding for terian-services.com
#
# Resources NOT managed here (pre-existing in rg_platform):
#   - rg_platform resource group
#   - terian-services.com App Service Domain
#   - terian-services.com DNS zone
#   - awardnomplatform storage account (used for TF state)
# ─────────────────────────────────────────────────────────────────────────────

locals {
  tags = {
    environment = "prod"
    project     = "terian-services"
    managed_by  = "terraform"
  }
}

# ── 0. Read existing rg_platform ──────────────────────────────────────────────
data "azurerm_resource_group" "platform" {
  name = var.resource_group_name
}

# ── 1. Read existing DNS zone ─────────────────────────────────────────────────
data "azurerm_dns_zone" "terian" {
  name                = var.dns_zone_name
  resource_group_name = var.resource_group_name
}

# ── 2. Static Web App ─────────────────────────────────────────────────────────
module "static_web_app" {
  source = "../../modules/static-web-app"

  resource_group_name = var.resource_group_name
  location            = var.location
  app_name            = var.swa_name
  tags                = local.tags
}

# ── 3. DNS — CNAME: terian-services.com → SWA default hostname ───────────────
# Azure SWA custom domain validation requires a CNAME record pointing at the
# SWA's default hostname.  For the apex domain (terian-services.com) Azure SWA
# uses a TXT record for ownership proof; the CNAME itself is only used for
# sub-domains.  We create both so the zone is ready for www too.
resource "azurerm_dns_cname_record" "www" {
  name                = "www"
  zone_name           = data.azurerm_dns_zone.terian.name
  resource_group_name = var.resource_group_name
  ttl                 = 300
  record              = module.static_web_app.default_hostname

  tags = local.tags
}

# ── 4. DNS — TXT record for apex domain ownership verification ────────────────
# Azure SWA generates the verification ID at creation time.
# We surface it via the module output and write it here so Terraform manages it.
resource "azurerm_dns_txt_record" "swa_verify" {
  name                = var.swa_verification_dns_name   # e.g. "_dnsauth" or "asuid"
  zone_name           = data.azurerm_dns_zone.terian.name
  resource_group_name = var.resource_group_name
  ttl                 = 300

  record {
    value = var.swa_verification_token
  }

  tags = local.tags
}

# ── 5. SWA custom domain ──────────────────────────────────────────────────────
# The domain binding must come AFTER the DNS records exist so Azure can validate
# ownership immediately.
resource "azurerm_static_web_app_custom_domain" "apex" {
  static_web_app_id = module.static_web_app.static_web_app_id
  domain_name       = var.dns_zone_name   # "terian-services.com"
  validation_type   = "dns-txt-token"

  depends_on = [
    azurerm_dns_txt_record.swa_verify,
    azurerm_dns_cname_record.www,
  ]
}

# www custom domain (optional — add after apex is working)
resource "azurerm_static_web_app_custom_domain" "www" {
  static_web_app_id = module.static_web_app.static_web_app_id
  domain_name       = "www.${var.dns_zone_name}"
  validation_type   = "cname-delegation"

  depends_on = [
    azurerm_dns_cname_record.www,
    azurerm_static_web_app_custom_domain.apex,
  ]
}
