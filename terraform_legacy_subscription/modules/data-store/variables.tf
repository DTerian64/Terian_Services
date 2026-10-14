# modules/data-store/variables.tf

variable "resource_group_name" {
  description = "Resource group to deploy all data-store resources into."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "storage_account_name" {
  description = "Storage Account name for media/photo assets (globally unique, 3–24 lowercase alphanumeric)."
  type        = string
}

variable "cosmos_account_name" {
  description = "Cosmos DB account name (globally unique, 3–44 lowercase alphanumeric + hyphens)."
  type        = string
}

variable "cosmos_database_name" {
  description = "Cosmos DB SQL database name."
  type        = string
  default     = "terian-services"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
