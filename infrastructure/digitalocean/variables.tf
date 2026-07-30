variable "digitalocean_token" { type = string; sensitive = true }
variable "project_name" { type = string; default = "jalwa-production" }
variable "region" { type = string; description = "DigitalOcean region slug, selected in the account before apply." }
variable "droplet_size" { type = string; default = "s-2vcpu-4gb" }
variable "droplet_image" { type = string; default = "ubuntu-24-04-x64" }
variable "ssh_public_key" { type = string; sensitive = true }
variable "admin_cidrs" { type = list(string); description = "CIDRs allowed to SSH, for example your office or VPN IP /32." }
variable "enable_backups" { type = bool; default = true }
variable "domain" { type = string; default = "watch-jalwa.com" }
