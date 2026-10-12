# Fully mocked providers; no Azure authentication, API, backend state, or writes.
mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      subscription_id = "2bb69129-5e74-44d9-af68-96d45633f667"
      tenant_id       = "5979eb86-9af1-4c74-8e50-acbe7d6a5cf9"
    }
  }
  mock_data "azurerm_resource_group" {
    defaults = {
      id       = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terianix_platform"
      name     = "rg_terianix_platform"
      location = "eastus2"
    }
  }
  mock_resource "azurerm_user_assigned_identity" {
    defaults = {
      id           = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.ManagedIdentity/userAssignedIdentities/test-github"
      principal_id = "11111111-1111-4111-8111-111111111111"
      client_id    = "22222222-2222-4222-8222-222222222222"
    }
  }
  mock_resource "azurerm_static_web_app_custom_domain" {
    defaults = {
      validation_token = "generated-public-test-token"
    }
  }
}
mock_provider "time" {}

override_module {
  target = module.container_app
  outputs = {
    container_app_name         = "test-backend"
    container_app_fqdn         = "test-backend.example.test"
    acr_name                   = "testregistry"
    acr_login_server           = "testregistry.azurecr.io"
    uami_principal_id          = "33333333-3333-4333-8333-333333333333"
    log_analytics_workspace_id = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.OperationalInsights/workspaces/test-logs"
  }
}
override_module {
  target = module.data_store
  outputs = {
    storage_account_name             = "teststorage"
    storage_account_id               = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.Storage/storageAccounts/teststorage"
    cosmos_account_name              = "testcosmos"
    cosmos_account_id                = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.DocumentDB/databaseAccounts/testcosmos"
    cosmos_database_name             = "terian-services"
    cosmos_endpoint                  = "https://testcosmos.documents.azure.com:443/"
    storage_blob_endpoint            = "https://teststorage.blob.core.windows.net/"
    storage_queue_endpoint           = "https://teststorage.queue.core.windows.net/"
    engagement_assets_container_name = "engagement-assets"
    engagement_intake_queue_name     = "engagement-intake"
  }
}
override_module {
  target = module.terian_services_frontend
  outputs = {
    static_web_app_id = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.Web/staticSites/terian-services-frontend-platform"
    default_hostname  = "calm-plant-0158e0a0f.5.azurestaticapps.net"
    api_key           = "test-token"
  }
}
override_module {
  target = module.terianix_frontend
  outputs = {
    static_web_app_id = "/subscriptions/2bb69129-5e74-44d9-af68-96d45633f667/resourceGroups/rg_terian_services_prod/providers/Microsoft.Web/staticSites/terianix-frontend-platform"
    default_hostname  = "zealous-rock-0c92ed20f.2.azurestaticapps.net"
    api_key           = "test-token"
  }
}

variables {
  custom_domains_enabled     = true
  shadow_dns_records_enabled = true
  source_dns_snapshot_path   = "tests/fixtures/source-dns.json"
  domain_validation_tokens   = {}
  dns_cname_overrides        = {}
}

run "preparation_does_not_use_source_alias_or_destroy_txt" {
  command = plan
  assert {
    condition = length(azurerm_static_web_app_custom_domain.migrated) == 4 && alltrue([
      for domain, binding in azurerm_static_web_app_custom_domain.migrated :
      binding.validation_type == (domain == "www.terian-services.com" ? "cname-delegation" : "dns-txt-token")
    ])
    error_message = "Terian Services www must retain its working CNAME validation; the other three bindings must retain TXT validation."
  }
  assert {
    condition     = azurerm_dns_a_record.terian_services_apex[0].target_resource_id == module.terian_services_frontend.static_web_app_id
    error_message = "The target apex must not retain the old subscription alias."
  }
  assert {
    condition     = azurerm_dns_cname_record.shadow["www"].record == module.terian_services_frontend.default_hostname
    error_message = "The target www record must point at the target frontend."
  }
  assert {
    condition     = toset([for txt in azurerm_dns_txt_record.shadow["@"].record : txt.value]) == toset(["v=spf1 include:zohomail.com ~all", "legacy-verification"])
    error_message = "Source TXT chunks and existing verification records must be preserved."
  }
  assert {
    condition     = length(azurerm_dns_mx_record.shadow["@"].record) == 3 && length(azurerm_dns_txt_record.target_validation) == 0
    error_message = "Mail records must be preserved; validation DNS waits for saved tokens."
  }
  assert {
    condition = (
      alltrue([for name in ["dev-awards", "awards", "app-link"] : !contains(keys(azurerm_dns_cname_record.shadow), name)]) &&
      alltrue([for name in ["demo", "synthetics", "_dnsauth.Acme-Awards"] : !contains(keys(azurerm_dns_txt_record.shadow), name)]) &&
      length(output.dns_retirement_review.excluded_award_dns_records) == 6 &&
      length(output.dns_retirement_review.skipped_empty_cnames) == 0 &&
      contains(keys(azurerm_dns_cname_record.shadow), "service")
    )
    error_message = "Award names/destinations and demo/synthetics TXT must be excluded, without dropping unrelated CNAMEs."
  }
}

run "saved_tokens_survive_azure_clearing_the_computed_token" {
  command = plan
  variables {
    domain_validation_tokens = {
      "terian-services.com"     = "saved-terian-apex"
      "www.terian-services.com" = "saved-terian-www"
      "terianix.ai"             = "saved-terianix-apex"
      "www.terianix.ai"         = "saved-terianix-www"
    }
    dns_cname_overrides = {
      "service" = "new-service.example.test"
    }
  }
  assert {
    condition     = output.domain_validation_tokens["terianix.ai"] == "saved-terianix-apex" && output.cloudflare_validation_records.apex.value == "saved-terianix-apex"
    error_message = "Saved tokens, not the ephemeral provider attribute, must drive subsequent output."
  }
  assert {
    condition     = output.cloudflare_validation_records.www_prevalidation.name == "www" && output.cloudflare_validation_records.www_prevalidation.value == "saved-terianix-www" && length(output.cloudflare_validation_records) == 2
    error_message = "Manual Cloudflare proof must use the verified www TXT location, without restoring apex/www proofs at _dnsauth.www."
  }
  assert {
    condition     = toset([for txt in azurerm_dns_txt_record.shadow["@"].record : txt.value]) == toset(["v=spf1 include:zohomail.com ~all", "legacy-verification", "saved-terian-apex"])
    error_message = "Adding validation must not overwrite existing root TXT."
  }
  assert {
    condition     = toset([for txt in azurerm_dns_txt_record.target_validation[0].record : txt.value]) == toset(["saved-terian-apex", "saved-terian-www"])
    error_message = "Both prevalidation values must exist in one Azure TXT record set."
  }
  assert {
    condition     = azurerm_dns_cname_record.shadow["service"].record == "new-service.example.test" && length(output.dns_retirement_review.unchanged_nonwebsite_cnames) == 0
    error_message = "Reviewed non-Award overrides must still work."
  }
}

run "reject_target_snapshot" {
  command = plan
  variables {
    source_dns_snapshot_path = "tests/fixtures/target-dns.json"
  }
  expect_failures = [terraform_data.dns_snapshot_guard[0]]
}

run "reject_unhandled_record_type" {
  command = plan
  variables {
    source_dns_snapshot_path = "tests/fixtures/unsupported-dns.json"
  }
  expect_failures = [terraform_data.dns_snapshot_guard[0]]
}

run "disabled_features_do_not_read_a_missing_snapshot" {
  command = plan
  variables {
    custom_domains_enabled     = false
    shadow_dns_records_enabled = false
    source_dns_snapshot_path   = "does-not-exist.json"
  }
  assert {
    condition     = length(azurerm_static_web_app_custom_domain.migrated) == 0 && length(azurerm_dns_a_record.terian_services_apex) == 0 && length(output.domain_validation_tokens) == 0
    error_message = "Disabled staging must create no domain/DNS resources or require an export."
  }
}

run "reject_incomplete_source_inventory" {
  command = plan
  variables {
    source_dns_snapshot_path = "tests/fixtures/incomplete-dns.json"
  }
  expect_failures = [terraform_data.dns_snapshot_guard[0]]
}

run "review_actual_local_export_when_present" {
  command = plan
  variables {
    source_dns_snapshot_path = fileexists("../../domain-cutover-local/source-20261009T235904Z-3718a164/snapshot.json") ? "../../domain-cutover-local/source-20261009T235904Z-3718a164/snapshot.json" : "tests/fixtures/source-dns.json"
  }
  assert {
    condition = alltrue([
      for source in local.source_dns_records :
      toset([for txt in azurerm_dns_txt_record.shadow[source.name].record : txt.value]) == toset([
        for txt in try(source.TXTRecords, source.txtRecords) : join("", txt.value)
      ])
      if source.type == "Microsoft.Network/dnszones/TXT"
    ])
    error_message = "The reviewed local source export's TXT values were not fully preserved."
  }
  assert {
    condition = (
      length(azurerm_dns_cname_record.shadow) + length(azurerm_dns_mx_record.shadow) +
      length(azurerm_dns_txt_record.shadow) + length(azurerm_dns_a_record.terian_services_apex) ==
      length(local.source_dns_records) - 2 - length(local.skipped_empty_cnames)
    )
    error_message = "Scoped record inventory differs beyond intentional NS/SOA preservation and empty CNAME reporting."
  }
}

run "cannot_reintroduce_an_excluded_award_name" {
  command = plan
  variables {
    dns_cname_overrides = {
      "dev-awards" = "new-service.example.test"
    }
  }
  expect_failures = [terraform_data.dns_snapshot_guard[0]]
}

run "cannot_route_a_retained_name_to_an_award_endpoint" {
  command = plan
  variables {
    dns_cname_overrides = {
      "service" = "new-award-endpoint.example.test"
    }
  }
  expect_failures = [terraform_data.dns_snapshot_guard[0]]
}

run "new_platform_award_hosts_are_not_touched_by_marketing_cutover" {
  command = plan
  assert {
    condition = alltrue([
      for hostname in [
        "awards.demo-awardsrus.terianix.ai",
        "awards.acmerus.terianix.ai",
        "awards.syntheticsrus.terianix.ai",
        "awards.sandboxrus.terianix.ai",
      ] : !contains(keys(azurerm_static_web_app_custom_domain.migrated), hostname)
    ])
    error_message = "Protected Award hostnames must not be rebound to a marketing frontend."
  }
  assert {
    condition = alltrue(concat(
      [for record in azurerm_dns_cname_record.shadow : record.zone_name == "terian-services.com"],
      [for record in azurerm_dns_txt_record.shadow : record.zone_name == "terian-services.com"],
      [for record in azurerm_dns_mx_record.shadow : record.zone_name == "terian-services.com"],
      [for record in azurerm_dns_a_record.terian_services_apex : record.zone_name == "terian-services.com"],
    ))
    error_message = "Azure DNS migration must not manage the Cloudflare terianix.ai zone."
  }
  assert {
    condition     = alltrue([for record in output.cloudflare_validation_records : contains(["@", "www"], record.name)])
    error_message = "Manual Cloudflare validation must remain scoped to the marketing domain, not protected Award or tenant-verification labels."
  }
}
