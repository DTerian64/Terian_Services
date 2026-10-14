# Use the existing Cloudflare zone; importing records does not transfer or
# recreate the zone. The token should grant Zone Read + DNS Edit for terianix.ai.
module "cloudflare_inventory" {
  source = "./modules/cloudflare-inventory"
}

locals {
  terianix_website_names = toset(["terianix.ai", "www.terianix.ai"])

  # Exactly one existing record is needed for adoption. The resource's
  # preconditions stop the plan if inventory is missing, ambiguous, or wrong.
  existing_terianix_websites = {
    for name in local.terianix_website_names :
    name => try(one(module.cloudflare_inventory.website_records[name]), null)
  }
}

resource "cloudflare_dns_record" "terianix_website" {
  for_each = local.terianix_website_names
  zone_id  = module.cloudflare_inventory.zone.id
  name     = each.key
  type     = "CNAME"
  content  = data.azurerm_static_web_app.terianix_frontend.default_host_name
  ttl      = 300
  proxied  = false
  comment  = try(local.existing_terianix_websites[each.key].comment, null)
  tags     = try(local.existing_terianix_websites[each.key].tags, null)
  settings = try(local.existing_terianix_websites[each.key].settings, null)

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = module.cloudflare_inventory.zone.name == "terianix.ai" && module.cloudflare_inventory.zone.status == "active"
      error_message = "The Cloudflare token must resolve the existing active terianix.ai zone."
    }
    precondition {
      condition     = try(length(module.cloudflare_inventory.website_records[each.key]) == 1 && local.existing_terianix_websites[each.key].name == each.key && local.existing_terianix_websites[each.key].type == "CNAME", false)
      error_message = "Each exact terianix.ai website hostname must have one existing CNAME. Inspect missing or conflicting records before adoption."
    }
  }
}
