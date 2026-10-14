# Explicit adoption of the existing four records. Keep the archived legacy
# root frozen: it previously owned all four and targets retired frontends.
import {
  to = azurerm_dns_a_record.apex_alias
  id = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_platform/providers/Microsoft.Network/dnsZones/terian-services.com/A/@"
}

import {
  to = azurerm_dns_cname_record.www
  id = "/subscriptions/4ddf12bb-5397-445f-bcaa-df4c7d3dfdca/resourceGroups/rg_platform/providers/Microsoft.Network/dnsZones/terian-services.com/CNAME/www"
}

import {
  for_each = {
    for name, records in module.cloudflare_inventory.website_records :
    name => records[0].id if contains(local.terianix_website_names, name) && length(records) == 1
  }
  to = cloudflare_dns_record.terianix_website[each.key]
  id = "${module.cloudflare_inventory.zone.id}/${each.value}"
}
