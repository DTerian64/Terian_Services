# Target-only Azure resources. Cloudflare remains manually managed.
variable "custom_domains_enabled" {
  description = "Manage the four target SWA bindings: Terian Services www uses CNAME validation; the other three use TXT. Does not switch authoritative DNS traffic."
  type        = bool
  default     = false
}

variable "shadow_dns_records_enabled" {
  description = "Populate the target non-authoritative zone from a reviewed source snapshot, excluding Award DNS and its demo/synthetics verification."
  type        = bool
  default     = false
}

variable "source_dns_snapshot_path" {
  description = "Local exporter snapshot.json. This is an offline input, not a source-subscription provider or remote state."
  type        = string
  default     = ""
}

variable "domain_validation_tokens" {
  description = "Persist generated tokens before public validation clears Azure's computed tokens. Written by save-terianix-domain-validation.ps1."
  type        = map(string)
  default     = {}

  validation {
    condition = alltrue([
      for domain, token in var.domain_validation_tokens :
      contains(["terian-services.com", "www.terian-services.com", "terianix.ai", "www.terianix.ai"], domain) && trimspace(token) != ""
    ])
    error_message = "Only the four migrated domains may have saved, nonempty validation tokens."
  }
}

variable "dns_cname_overrides" {
  description = "Reviewed replacements for retained non-website CNAMEs. Cannot reintroduce excluded Award names or destinations."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for name, hostname in var.dns_cname_overrides : name != "www" && trimspace(hostname) != ""])
    error_message = "Override values must be nonempty; www is always derived from the target SWA."
  }
}

locals {
  migrated_domains = {
    "terian-services.com"     = module.terian_services_frontend.static_web_app_id
    "www.terian-services.com" = module.terian_services_frontend.static_web_app_id
    "terianix.ai"             = module.terianix_frontend.static_web_app_id
    "www.terianix.ai"         = module.terianix_frontend.static_web_app_id
  }
  effective_domain_validation_tokens = {
    for domain, binding in azurerm_static_web_app_custom_domain.migrated :
    domain => lookup(var.domain_validation_tokens, domain, binding.validation_token)
  }
  source_dns_snapshot    = var.shadow_dns_records_enabled ? jsondecode(file(var.source_dns_snapshot_path)) : null
  all_source_dns_records = try(local.source_dns_snapshot.recordSets, [])
  # Award DNS belongs to a separate migration, not this Terian website zone.
  # David also confirmed that demo/synthetics TXT are Award-related.
  # Match names, CNAME destinations, and alias IDs so an innocently named
  # record cannot retain an Award endpoint or restore it through an override.
  excluded_award_dns_records = {
    for record in local.all_source_dns_records :
    "${replace(record.type, "Microsoft.Network/dnszones/", "")}/${record.name}" => {
      name = record.name
      type = replace(record.type, "Microsoft.Network/dnszones/", "")
    }
    if(
      contains(["demo", "synthetics"], lower(record.name)) ||
      can(regex("(?i)award", record.name)) ||
      can(regex("(?i)award", try(record.CNAMERecord.cname, record.cnameRecord.cname, ""))) ||
      can(regex("(?i)award", try(record.targetResource.id, "")))
    )
  }
  source_dns_records = [
    for record in local.all_source_dns_records : record
    if !contains(keys(local.excluded_award_dns_records), "${replace(record.type, "Microsoft.Network/dnszones/", "")}/${record.name}")
  ]
  supported_dns_types = [
    "Microsoft.Network/dnszones/A", "Microsoft.Network/dnszones/CNAME",
    "Microsoft.Network/dnszones/TXT", "Microsoft.Network/dnszones/MX",
    "Microsoft.Network/dnszones/NS", "Microsoft.Network/dnszones/SOA",
  ]
  shadow_cnames = {
    for record in local.source_dns_records : record.name => {
      ttl = try(record.TTL, record.ttl)
      destination = record.name == "www" ? module.terian_services_frontend.default_hostname : lookup(
        var.dns_cname_overrides, record.name, try(record.CNAMERecord.cname, record.cnameRecord.cname, "")
      )
    }
    if record.type == "Microsoft.Network/dnszones/CNAME" && (
      try(record.CNAMERecord.cname, record.cnameRecord.cname, "") != "" || contains(keys(var.dns_cname_overrides), record.name)
    )
  }
  shadow_txt = {
    for record in local.source_dns_records : record.name => {
      ttl    = try(record.TTL, record.ttl)
      values = [for txt in try(record.TXTRecords, record.txtRecords) : join("", txt.value)]
    }
    if record.type == "Microsoft.Network/dnszones/TXT"
  }
  shadow_mx = {
    for record in local.source_dns_records : record.name => {
      ttl     = try(record.TTL, record.ttl)
      records = try(record.MXRecords, record.mxRecords)
    }
    if record.type == "Microsoft.Network/dnszones/MX"
  }
  saved_terian_services_tokens = {
    for domain, token in var.domain_validation_tokens : domain => token
    if contains(["terian-services.com", "www.terian-services.com"], domain)
  }
  skipped_empty_cnames = [
    for record in local.source_dns_records : record.name
    if record.type == "Microsoft.Network/dnszones/CNAME" &&
    try(record.CNAMERecord.cname, record.cnameRecord.cname, "") == "" &&
    !contains(keys(var.dns_cname_overrides), record.name)
  ]
}

resource "azurerm_static_web_app_custom_domain" "migrated" {
  for_each          = var.custom_domains_enabled ? local.migrated_domains : {}
  static_web_app_id = each.value
  domain_name       = each.key
  # Match David's manually recreated, Ready www binding. Its public CNAME
  # already points to the target SWA; no www TXT token is required.
  validation_type = each.key == "www.terian-services.com" ? "cname-delegation" : "dns-txt-token"

  lifecycle {
    prevent_destroy = true
    # Azure does not return the validation method. AzureRM keeps the original
    # creation value in state, even after manual revalidation of the same ID.
    # Apply the configured method on creation, not by replacing Ready bindings.
    # This is deliberately limited to creation metadata; IDs/domains stay managed.
    ignore_changes = [validation_type]
  }
}

# Fail closed rather than silently drop unsupported records, child delegations,
# or additional aliases within the migration scope. Award-related records are
# intentionally excluded before these checks; the complete export is retained
# separately for the inventory-completeness check.
resource "terraform_data" "dns_snapshot_guard" {
  count = var.shadow_dns_records_enabled ? 1 : 0
  input = sha256(file(var.source_dns_snapshot_path))

  lifecycle {
    precondition {
      condition = (
        local.source_dns_snapshot.side == "Source" &&
        local.source_dns_snapshot.subscriptionId == "4ddf12bb-5397-445f-bcaa-df4c7d3dfdca" &&
        local.source_dns_snapshot.zone.name == "terian-services.com" &&
        var.dns_zone_name == "terian-services.com"
      )
      error_message = "Use the reviewed SOURCE terian-services.com snapshot, not a target or unrelated zone."
    }
    precondition {
      condition = alltrue([
        for record in local.source_dns_records :
        contains(local.supported_dns_types, record.type) &&
        (record.type != "Microsoft.Network/dnszones/A" || record.name == "@") &&
        (record.type != "Microsoft.Network/dnszones/NS" || record.name == "@") &&
        (record.type != "Microsoft.Network/dnszones/SOA" || record.name == "@") &&
        (try(record.targetResource.id, "") == "" || (record.type == "Microsoft.Network/dnszones/A" && record.name == "@"))
      ])
      error_message = "The snapshot contains unsupported record types, child NS, extra A records, or aliases needing explicit configuration. Stop and extend the record configuration."
    }
    precondition {
      condition = alltrue([
        for name, hostname in var.dns_cname_overrides :
        contains([for record in local.source_dns_records : record.name if record.type == "Microsoft.Network/dnszones/CNAME"], name) &&
        !can(regex("(?i)award", hostname))
      ])
      error_message = "Overrides must refer to retained CNAMEs and cannot reintroduce excluded Award records or point to Award destinations."
    }
    precondition {
      condition = (
        length(local.all_source_dns_records) == try(local.source_dns_snapshot.zone.numberOfRecordSets, length(local.all_source_dns_records)) &&
        alltrue([for required in [
          { name = "@", type = "Microsoft.Network/dnszones/A" },
          { name = "www", type = "Microsoft.Network/dnszones/CNAME" },
          { name = "@", type = "Microsoft.Network/dnszones/MX" },
          { name = "@", type = "Microsoft.Network/dnszones/TXT" },
        ] : anytrue([for record in local.source_dns_records : record.name == required.name && record.type == required.type])])
      )
      error_message = "The source export is incomplete or lacks required website/mail/root TXT records."
    }
    precondition {
      condition     = !contains([for record in local.source_dns_records : record.name if record.type == "Microsoft.Network/dnszones/TXT"], "_dnsauth.www")
      error_message = "Use the original prevalidation snapshot. _dnsauth.www is separately owned by target_validation; a refreshed export needs an explicit merge to avoid duplicate ownership."
    }
  }
}

resource "azurerm_dns_a_record" "terian_services_apex" {
  count               = var.shadow_dns_records_enabled ? 1 : 0
  name                = "@"
  zone_name           = azurerm_dns_zone.terian_services.name
  resource_group_name = data.azurerm_resource_group.platform.name
  ttl                 = 300
  target_resource_id  = module.terian_services_frontend.static_web_app_id
  tags                = local.tags
  depends_on          = [terraform_data.dns_snapshot_guard]

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_dns_cname_record" "shadow" {
  for_each            = local.shadow_cnames
  name                = each.key
  zone_name           = azurerm_dns_zone.terian_services.name
  resource_group_name = data.azurerm_resource_group.platform.name
  ttl                 = each.key == "www" ? 300 : each.value.ttl
  record              = each.value.destination
  tags                = local.tags
  depends_on          = [terraform_data.dns_snapshot_guard]

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_dns_mx_record" "shadow" {
  for_each            = local.shadow_mx
  name                = each.key
  zone_name           = azurerm_dns_zone.terian_services.name
  resource_group_name = data.azurerm_resource_group.platform.name
  ttl                 = each.value.ttl
  tags                = local.tags
  depends_on          = [terraform_data.dns_snapshot_guard]

  dynamic "record" {
    for_each = each.value.records
    content {
      preference = record.value.preference
      exchange   = record.value.exchange
    }
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_dns_txt_record" "shadow" {
  for_each            = local.shadow_txt
  name                = each.key
  zone_name           = azurerm_dns_zone.terian_services.name
  resource_group_name = data.azurerm_resource_group.platform.name
  ttl                 = each.value.ttl
  tags                = local.tags
  depends_on          = [terraform_data.dns_snapshot_guard]

  dynamic "record" {
    # Preserve all source TXT values, including SPF/DKIM, and add the persisted
    # apex token only in the non-authoritative target zone.
    for_each = distinct(concat(each.value.values, each.key == "@" ? [
      for domain, token in local.saved_terian_services_tokens : token if domain == "terian-services.com"
    ] : []))
    content {
      value = record.value
    }
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_dns_txt_record" "target_validation" {
  count               = var.shadow_dns_records_enabled && length(local.saved_terian_services_tokens) > 0 ? 1 : 0
  name                = "_dnsauth.www"
  zone_name           = azurerm_dns_zone.terian_services.name
  resource_group_name = data.azurerm_resource_group.platform.name
  ttl                 = 300
  tags                = local.tags
  depends_on          = [terraform_data.dns_snapshot_guard]

  dynamic "record" {
    for_each = toset(values(local.saved_terian_services_tokens))
    content {
      value = record.value
    }
  }
  lifecycle {
    prevent_destroy = true
  }
}

output "domain_validation_tokens" {
  description = "Save these before validation clears Azure's token attribute; these are public DNS verification values."
  value       = local.effective_domain_validation_tokens
  sensitive   = true
}

output "cloudflare_validation_records" {
  description = "Manual Terianix TXT records at @ and www, matching the operator-verified successful validation. Preserve CNAME/MX/NS/mail TXT. No Cloudflare provider."
  sensitive   = true
  value = var.custom_domains_enabled ? {
    apex = {
      type  = "TXT", name = "@", ttl = 300
      value = local.effective_domain_validation_tokens["terianix.ai"]
    }
    www_prevalidation = {
      type  = "TXT", name = "www", ttl = 300
      value = local.effective_domain_validation_tokens["www.terianix.ai"]
    }
  } : {}
}

output "dns_retirement_review" {
  description = "Retained non-Award records, deliberate Award exclusions, and remaining registration blocker. Exclusion does not delete source DNS."
  value = {
    unchanged_nonwebsite_cnames = {
      for name, record in local.shadow_cnames : name => record.destination
      if name != "www" && !contains(keys(var.dns_cname_overrides), name)
    }
    excluded_award_dns_records = local.excluded_award_dns_records
    skipped_empty_cnames       = local.skipped_empty_cnames
    registration               = "terian-services.com App Service Domain still belongs to the old subscription; relocation/transfer is a separate blocker."
  }
}
