variable "cloudflare_api_token" {
  description = "Cloudflare token scoped to terianix.ai with Zone Read and DNS Edit. Set in the ignored terraform.tfvars file."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(trimspace(var.cloudflare_api_token)) > 0
    error_message = "Set cloudflare_api_token in terraform.tfvars before planning production DNS."
  }
}
