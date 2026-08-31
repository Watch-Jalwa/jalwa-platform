variable "digitalocean_token" {
  type      = string
  sensitive = true
}

variable "project_name" {
  type    = string
  default = "jalwa-production"
}

variable "deployment_environment" {
  type        = string
  default     = "production"
  description = "Deployment environment label used for DigitalOcean project metadata and resource tags."

  validation {
    condition     = contains(["production", "staging"], var.deployment_environment)
    error_message = "deployment_environment must be either production or staging."
  }
}

variable "region" {
  type        = string
  description = "DigitalOcean region slug, selected in the account before apply."
}

variable "droplet_size" {
  type        = string
  default     = "s-4vcpu-8gb"
  description = "Combined web, worker and PostgreSQL services require at least 4 vCPU and 8 GB RAM."
}

variable "droplet_image" {
  type    = string
  default = "ubuntu-24-04-x64"
}

variable "ssh_public_key" {
  type      = string
  sensitive = true
}

variable "admin_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH, for example your office or VPN IP /32."
}

variable "enable_backups" {
  type    = bool
  default = true
}

variable "domain" {
  type    = string
  default = "watch-jalwa.com"
}
