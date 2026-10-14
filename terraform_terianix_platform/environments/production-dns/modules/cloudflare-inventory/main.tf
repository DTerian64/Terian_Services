# Read-only discovery of the two website CNAMEs. No zone or record is created
# here; production-dns owns the imported resources and validates this inventory.
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

data "cloudflare_zone" "terianix" {
  filter = { name = "terianix.ai" }
}

data "cloudflare_dns_records" "website" {
  for_each = toset(["terianix.ai", "www.terianix.ai"])
  zone_id  = data.cloudflare_zone.terianix.id
  name     = { exact = each.key }
  type     = "CNAME"
}

output "zone" {
  value = {
    id     = data.cloudflare_zone.terianix.id
    name   = data.cloudflare_zone.terianix.name
    status = data.cloudflare_zone.terianix.status
  }
}

output "website_records" {
  value = {
    for name, lookup in data.cloudflare_dns_records.website : name => [
      for record in lookup.result : {
        id       = record.id
        name     = record.name
        type     = record.type
        comment  = record.comment
        tags     = record.tags
        settings = record.settings
      }
    ]
  }
}
