# environments/prod/variables.tf

variable "resource_group_name" {
  description = "Existing resource group that owns the DNS zone and SWA (rg_platform)"
  type        = string
  default     = "rg_platform"
}

variable "location" {
  description = "Azure region for the Static Web App"
  type        = string
  default     = "eastus2"
}

variable "swa_name" {
  description = "Static Web App resource name"
  type        = string
  default     = "terian-services-frontend"
}

variable "dns_zone_name" {
  description = "DNS zone name — must match the existing App Service Domain"
  type        = string
  default     = "terian-services.com"
}

# ── SWA domain verification ───────────────────────────────────────────────────
# After `terraform apply` creates the SWA, retrieve these values with:
#   az staticwebapp show --name terian-services-frontend --resource-group rg_platform \
#     --query "customDomainVerificationId" -o tsv
#
# The TXT record name is "asuid" for apex domains in Azure SWA.

variable "swa_verification_dns_name" {
  description = "DNS TXT record name for SWA ownership verification (usually 'asuid' for apex)"
  type        = string
  default     = "asuid"
}

variable "swa_verification_token" {
  description = "SWA custom domain verification token — retrieve from Azure portal or az CLI after SWA creation"
  type        = string
  default     = ""   # Fill in terraform.tfvars after first apply
}
