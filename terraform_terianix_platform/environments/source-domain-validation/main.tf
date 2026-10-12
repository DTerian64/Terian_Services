# TEMPORARY migration helper, not the production target root.
# Owns the new www TXT set, and optionally adopts the existing apex TXT set
# only to append target proof while preserving all live values/TTL/tags.
# Local state is kept outside this root in the ignored cutover evidence folder.
terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.116"
    }
  }
  backend "local" {
    path = "../../domain-cutover-local/source-domain-validation.tfstate"
  }
}

provider "azurerm" {
  features {}
  subscription_id            = "4ddf12bb-5397-445f-bcaa-df4c7d3dfdca"
  tenant_id                  = "4d5f34d3-d97b-40c7-8704-edff856d3654"
  skip_provider_registration = true
}

variable "terian_services_domain_validation_tokens" {
  description = "Persisted target tokens for apex and www. Empty means no resources."
  type        = map(string)
  default     = {}
  validation {
    condition = length(var.terian_services_domain_validation_tokens) == 0 || (
      length(var.terian_services_domain_validation_tokens) == 2 &&
      alltrue([for domain, token in var.terian_services_domain_validation_tokens :
        contains(["terian-services.com", "www.terian-services.com"], domain) && trimspace(token) != ""
      ])
    )
    error_message = "Supply both target Terian Services tokens, or an empty map."
  }
}

resource "azurerm_dns_txt_record" "target_validation" {
  count               = length(var.terian_services_domain_validation_tokens) > 0 ? 1 : 0
  name                = "_dnsauth.www"
  zone_name           = "terian-services.com"
  resource_group_name = "rg_platform"
  ttl                 = 300
  dynamic "record" {
    for_each = toset(values(var.terian_services_domain_validation_tokens))
    content {
      value = record.value
    }
  }
  lifecycle {
    prevent_destroy = true
  }
}

# Opt-in because TXT/@ is a whole Azure record set. Do not put the same set
# into two actively applied Terraform states. The legacy Terian root owns
# asuid, not TXT/@. If another state owns @, freeze its applies and retire or
# hand off its ownership before this approved temporary takeover.
variable "adopt_source_apex_txt" {
  description = "After confirming sole ownership or approving takeover with other owning states frozen, import source TXT/@ and append the saved target apex token."
  type        = bool
  default     = false
}

data "azurerm_dns_txt_record" "source_apex" {
  count               = var.adopt_source_apex_txt ? 1 : 0
  name                = "@"
  zone_name           = "terian-services.com"
  resource_group_name = "rg_platform"
}

locals {
  source_apex_validation_values = var.adopt_source_apex_txt ? toset(concat(
    [for record in data.azurerm_dns_txt_record.source_apex[0].record : record.value],
    [for domain, token in var.terian_services_domain_validation_tokens : token if domain == "terian-services.com"],
  )) : toset([])
}

import {
  for_each = var.adopt_source_apex_txt ? toset(["apex"]) : toset([])
  to       = azurerm_dns_txt_record.apex_validation[0]
  id       = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_platform/providers/Microsoft.Network/dnsZones/terian-services.com/TXT/@"
}

resource "azurerm_dns_txt_record" "apex_validation" {
  count               = var.adopt_source_apex_txt ? 1 : 0
  name                = "@"
  zone_name           = "terian-services.com"
  resource_group_name = "rg_platform"
  ttl                 = data.azurerm_dns_txt_record.source_apex[0].ttl
  tags                = data.azurerm_dns_txt_record.source_apex[0].tags

  dynamic "record" {
    for_each = local.source_apex_validation_values
    content {
      value = record.value
    }
  }
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = contains(keys(var.terian_services_domain_validation_tokens), "terian-services.com")
      error_message = "Persist the target apex token before adopting source TXT/@."
    }
  }
}
