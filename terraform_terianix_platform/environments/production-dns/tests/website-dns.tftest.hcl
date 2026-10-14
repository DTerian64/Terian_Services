# No cloud authentication, API calls, backend reads, or writes.
variables {
  cloudflare_api_token = "mock-token-for-offline-tests-only"
}

mock_provider "azurerm" {
  mock_data "azurerm_dns_zone" {
    defaults = {
      name                = "terian-services.com"
      resource_group_name = "rg_platform"
      name_servers = [
        "ns1-04.azure-dns.com.", "ns2-04.azure-dns.net.",
        "ns3-04.azure-dns.org.", "ns4-04.azure-dns.info.",
      ]
    }
  }
  mock_data "azurerm_dns_cname_record" {
    defaults = { tags = { owner = "existing-dns-owner" } }
  }
}

mock_provider "azurerm" {
  alias = "platform"
}

mock_provider "cloudflare" {}

override_data {
  target = data.azurerm_static_web_app.frontend
  values = {
    id                = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.Web/staticSites/terian-services-frontend-platform"
    default_host_name = "calm-plant-0158e0a0f.5.azurestaticapps.net"
  }
}

override_data {
  target = data.azurerm_static_web_app.terianix_frontend
  values = {
    id                = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.Web/staticSites/terianix-frontend-platform"
    default_host_name = "zealous-rock-0c92ed20f.2.azurestaticapps.net"
  }
}

# Override the read-only inventory module because provider mocking cannot
# represent arbitrary lengths of computed nested collections. This also lets
# the tests supply invalid inventory to the real root-level preconditions.
override_module {
  target = module.cloudflare_inventory
  outputs = {
    zone = {
      id = "11111111111111111111111111111111", name = "terianix.ai", status = "active"
    }
    website_records = {
      "terianix.ai" = [{
        id       = "22222222222222222222222222222222", name = "terianix.ai", type = "CNAME"
        comment  = "Existing website record"
        tags     = ["owner:marketing"]
        settings = { flatten_cname = false, ipv4_only = false, ipv6_only = false }
      }]
      "www.terianix.ai" = [{
        id       = "33333333333333333333333333333333", name = "www.terianix.ai", type = "CNAME"
        comment  = "Existing website record"
        tags     = ["owner:marketing"]
        settings = { flatten_cname = false, ipv4_only = false, ipv6_only = false }
      }]
    }
  }
}

# Imports require per-instance overrides instead of a mock ImportResourceState.
override_resource {
  target = azurerm_dns_a_record.apex_alias
}
override_resource {
  target = azurerm_dns_cname_record.www
}
override_resource {
  target = cloudflare_dns_record.terianix_website["terianix.ai"]
}
override_resource {
  target = cloudflare_dns_record.terianix_website["www.terianix.ai"]
}

run "only_websites_route_to_their_own_frontends" {
  command = plan

  assert {
    condition     = azurerm_dns_a_record.apex_alias.target_resource_id == data.azurerm_static_web_app.frontend.id && azurerm_dns_cname_record.www.record == "calm-plant-0158e0a0f.5.azurestaticapps.net"
    error_message = "Both Azure website records must route to the current Terian Services frontend."
  }
  assert {
    condition = alltrue([
      for record in cloudflare_dns_record.terianix_website :
      record.content == "zealous-rock-0c92ed20f.2.azurestaticapps.net" && record.type == "CNAME" && !record.proxied && record.ttl == 300
    ])
    error_message = "Cloudflare website CNAMEs must route to Terianix, use DNS-only, and keep TTL 300."
  }
  assert {
    condition     = toset(keys(output.managed_website_records)) == toset(["terian-services.com", "www.terian-services.com", "terianix.ai", "www.terianix.ai"])
    error_message = "Ownership must be limited to the four apex/www website hostnames."
  }
  assert {
    condition = azurerm_dns_cname_record.www.tags["owner"] == "existing-dns-owner" && alltrue([
      for record in cloudflare_dns_record.terianix_website :
      record.comment == "Existing website record" && contains(record.tags, "owner:marketing") && !record.settings.flatten_cname
    ])
    error_message = "Adopting website records must preserve their existing metadata and per-record settings."
  }
}

run "reject_shadow_azure_zone" {
  command = plan
  override_data {
    target = data.azurerm_dns_zone.authoritative
    values = {
      name = "terian-services.com", resource_group_name = "rg_platform"
      name_servers = [
        "ns1-08.azure-dns.com.", "ns2-08.azure-dns.net.",
        "ns3-08.azure-dns.org.", "ns4-08.azure-dns.info.",
      ]
    }
  }
  expect_failures = [azurerm_dns_a_record.apex_alias, azurerm_dns_cname_record.www]
}

run "reject_inactive_or_wrong_cloudflare_zone" {
  command = plan
  override_module {
    target = module.cloudflare_inventory
    outputs = {
      zone = {
        id = "11111111111111111111111111111111", name = "other.example", status = "pending"
      }
      website_records = {
        "terianix.ai" = [{
          id      = "22222222222222222222222222222222", name = "terianix.ai", type = "CNAME"
          comment = null, tags = [], settings = null
        }]
        "www.terianix.ai" = [{
          id      = "33333333333333333333333333333333", name = "www.terianix.ai", type = "CNAME"
          comment = null, tags = [], settings = null
        }]
      }
    }
  }
  expect_failures = [cloudflare_dns_record.terianix_website]
}

run "reject_missing_cloudflare_cname" {
  command = plan
  override_module {
    target = module.cloudflare_inventory
    outputs = {
      zone = {
        id = "11111111111111111111111111111111", name = "terianix.ai", status = "active"
      }
      website_records = {
        "terianix.ai" = []
        "www.terianix.ai" = [{
          id      = "33333333333333333333333333333333", name = "www.terianix.ai", type = "CNAME"
          comment = null, tags = [], settings = null
        }]
      }
    }
  }
  expect_failures = [cloudflare_dns_record.terianix_website["terianix.ai"]]
}

run "reject_ambiguous_cloudflare_cname" {
  command = plan
  override_module {
    target = module.cloudflare_inventory
    outputs = {
      zone = {
        id = "11111111111111111111111111111111", name = "terianix.ai", status = "active"
      }
      website_records = {
        "terianix.ai" = [
          { id = "22222222222222222222222222222222", name = "terianix.ai", type = "CNAME" },
          { id = "44444444444444444444444444444444", name = "terianix.ai", type = "CNAME" },
        ]
        "www.terianix.ai" = [{
          id      = "33333333333333333333333333333333", name = "www.terianix.ai", type = "CNAME"
          comment = null, tags = [], settings = null
        }]
      }
    }
  }
  expect_failures = [cloudflare_dns_record.terianix_website["terianix.ai"]]
}
