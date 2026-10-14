# Keep the existing output name as well as the apex resource address.
output "apex_alias" {
  value = {
    record_id          = azurerm_dns_a_record.apex_alias.id
    target_resource_id = azurerm_dns_a_record.apex_alias.target_resource_id
    target_hostname    = data.azurerm_static_web_app.frontend.default_host_name
    name_servers       = data.azurerm_dns_zone.authoritative.name_servers
  }
}

output "managed_website_records" {
  description = "The complete four-record ownership boundary of this root. Other zone records are not adopted."
  value = {
    "terian-services.com" = {
      provider = "Azure DNS"
      type     = "A alias"
      target   = azurerm_dns_a_record.apex_alias.target_resource_id
    }
    "www.terian-services.com" = {
      provider = "Azure DNS"
      type     = "CNAME"
      target   = azurerm_dns_cname_record.www.record
    }
    "terianix.ai" = {
      provider = "Cloudflare"
      type     = "CNAME (apex flattening)"
      target   = cloudflare_dns_record.terianix_website["terianix.ai"].content
    }
    "www.terianix.ai" = {
      provider = "Cloudflare"
      type     = "CNAME"
      target   = cloudflare_dns_record.terianix_website["www.terianix.ai"].content
    }
  }
}
