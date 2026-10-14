# Only A/@ and CNAME/www in the currently authoritative ns*-04 zone.
# The ns*-08 shadow zone is a different resource owned by ../prod.
data "azurerm_dns_cname_record" "existing_www" {
  name                = "www"
  zone_name           = data.azurerm_dns_zone.authoritative.name
  resource_group_name = data.azurerm_dns_zone.authoritative.resource_group_name
}

locals {
  authoritative_azure_nameservers = toset([
    for server in data.azurerm_dns_zone.authoritative.name_servers : trimsuffix(lower(server), ".")
  ])
  expected_azure_nameservers = toset([
    "ns1-04.azure-dns.com", "ns2-04.azure-dns.net",
    "ns3-04.azure-dns.org", "ns4-04.azure-dns.info",
  ])
}

# Preserve the original apex address for anyone who applied the earlier root.
resource "azurerm_dns_a_record" "apex_alias" {
  name                = "@"
  zone_name           = data.azurerm_dns_zone.authoritative.name
  resource_group_name = data.azurerm_dns_zone.authoritative.resource_group_name
  ttl                 = 300
  target_resource_id  = data.azurerm_static_web_app.frontend.id
  tags = {
    environment = "prod"
    managed_by  = "terraform"
    project     = "terian-services"
  }

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = local.authoritative_azure_nameservers == local.expected_azure_nameservers
      error_message = "Only the retained authoritative ns*-04 zone in rg_platform may be managed here. Review ownership if delegation changes."
    }
  }
}

resource "azurerm_dns_cname_record" "www" {
  name                = "www"
  zone_name           = data.azurerm_dns_zone.authoritative.name
  resource_group_name = data.azurerm_dns_zone.authoritative.resource_group_name
  ttl                 = 300
  record              = data.azurerm_static_web_app.frontend.default_host_name
  tags                = data.azurerm_dns_cname_record.existing_www.tags

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = local.authoritative_azure_nameservers == local.expected_azure_nameservers
      error_message = "Only the retained authoritative ns*-04 zone in rg_platform may be managed here."
    }
  }
}
