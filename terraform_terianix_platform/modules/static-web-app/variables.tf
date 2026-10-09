# modules/static-web-app/variables.tf

variable "resource_group_name" {
  description = "Resource group to deploy into"
  type        = string
}

variable "location" {
  description = "Azure region for the Static Web App"
  type        = string
  default     = "eastus2"
}

variable "app_name" {
  description = "Static Web App resource name"
  type        = string
}

variable "tags" {
  description = "Tags to apply to the resource"
  type        = map(string)
  default     = {}
}

variable "app_settings" {
  description = "Key/value map of SWA application settings. VITE_* values here are injected as environment variables during the SWA build step, so the frontend bundle picks them up at compile time."
  type        = map(string)
  default     = {}
}
