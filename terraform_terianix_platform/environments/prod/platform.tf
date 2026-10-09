# The Integrity Sentinel platform Terraform state owns this resource group.
# This root may place explicitly approved Terian platform resources inside it,
# but must not import or claim the resource group itself.
data "azurerm_resource_group" "platform" {
  name = var.platform_resource_group_name
}

# This zone is non-authoritative until the registrar name-server delegation is
# changed. Record migration and delegation are separate, reviewed cutover steps.
resource "azurerm_dns_zone" "terian_services" {
  name                = var.dns_zone_name
  resource_group_name = data.azurerm_resource_group.platform.name
  tags                = local.tags

  lifecycle {
    prevent_destroy = true
  }
}
