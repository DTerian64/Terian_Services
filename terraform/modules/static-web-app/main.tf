# modules/static-web-app/main.tf
# ─────────────────────────────────────────────────────────────────────────────
# Azure Static Web App for terian-services.com
#
# Free SKU is sufficient — this is a marketing/privacy site with no auth,
# no API, and a single custom domain (terian-services.com).
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_static_web_app" "site" {
  name                = var.app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = var.tags
}
