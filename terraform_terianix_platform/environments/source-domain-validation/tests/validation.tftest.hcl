mock_provider "azurerm" {
  mock_data "azurerm_dns_txt_record" {
    defaults = {
      ttl = 3600
      tags = {
        owner = "existing-owner"
      }
      record = [
        { value = "MS=existing-one" },
        { value = "MS=existing-two" },
        { value = "v=spf1 include:zoho.com ~all" },
        { value = "legacy-swa-token" },
      ]
    }
  }
}
variables {
  adopt_source_apex_txt                    = false
  terian_services_domain_validation_tokens = {}
}
run "disabled_helper_creates_nothing" {
  command = plan
  assert {
    condition     = length(azurerm_dns_txt_record.target_validation) == 0 && length(azurerm_dns_txt_record.apex_validation) == 0
    error_message = "An unconfigured helper must not write source DNS."
  }
}
run "helper_only_adds_the_two_target_proofs" {
  command = plan
  variables {
    terian_services_domain_validation_tokens = {
      "terian-services.com"     = "test-apex"
      "www.terian-services.com" = "test-www"
    }
  }
  assert {
    condition = (
      length(azurerm_dns_txt_record.target_validation) == 1 &&
      azurerm_dns_txt_record.target_validation[0].name == "_dnsauth.www" &&
      azurerm_dns_txt_record.target_validation[0].zone_name == "terian-services.com" &&
      azurerm_dns_txt_record.target_validation[0].resource_group_name == "rg_platform" &&
      toset([for record in azurerm_dns_txt_record.target_validation[0].record : record.value]) == toset(["test-apex", "test-www"])
    )
    error_message = "Source validation must remain scoped to one new TXT set with both target values."
  }
}
run "helper_rejects_unrelated_domains" {
  command = plan
  variables {
    terian_services_domain_validation_tokens = {
      "terianix.ai"     = "wrong-domain"
      "www.terianix.ai" = "wrong-domain"
    }
  }
  expect_failures = [var.terian_services_domain_validation_tokens]
}

run "apex_adoption_preserves_every_existing_value_and_metadata" {
  command = plan
  override_resource {
    target = azurerm_dns_txt_record.apex_validation[0]
    values = {
      id                  = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_platform/providers/Microsoft.Network/dnsZones/terian-services.com/TXT/@"
      name                = "@"
      zone_name           = "terian-services.com"
      resource_group_name = "rg_platform"
      ttl                 = 3600
      tags                = { owner = "existing-owner" }
      record = [
        { value = "MS=existing-one" },
        { value = "MS=existing-two" },
        { value = "v=spf1 include:zoho.com ~all" },
        { value = "legacy-swa-token" },
      ]
    }
  }
  variables {
    adopt_source_apex_txt = true
    terian_services_domain_validation_tokens = {
      "terian-services.com"     = "test-apex"
      "www.terian-services.com" = "test-www"
    }
  }
  assert {
    condition = (
      toset([for record in azurerm_dns_txt_record.apex_validation[0].record : record.value]) == toset([
        "MS=existing-one", "MS=existing-two",
        "v=spf1 include:zoho.com ~all", "legacy-swa-token", "test-apex",
      ]) &&
      azurerm_dns_txt_record.apex_validation[0].ttl == 3600 &&
      azurerm_dns_txt_record.apex_validation[0].tags == tomap({ owner = "existing-owner" })
    )
    error_message = "Apex correction must preserve all existing TXT, TTL, and tags; add only the apex proof."
  }
  assert {
    condition     = !contains([for record in azurerm_dns_txt_record.apex_validation[0].record : record.value], "test-www")
    error_message = "Only the apex token belongs in the root TXT correction."
  }
}
