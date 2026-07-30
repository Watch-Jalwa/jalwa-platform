output "droplet_id" {
  value = digitalocean_droplet.jalwa.id
}

output "ipv4_address" {
  value = digitalocean_droplet.jalwa.ipv4_address
}

output "ipv6_address" {
  value = digitalocean_droplet.jalwa.ipv6_address
}

output "ssh_user" {
  value = "jalwa"
}

output "ssh_command" {
  value = "ssh jalwa@${digitalocean_droplet.jalwa.ipv4_address}"
}
