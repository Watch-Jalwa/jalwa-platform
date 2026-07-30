resource "digitalocean_ssh_key" "jalwa" {
  name       = "${var.project_name}-deploy"
  public_key = var.ssh_public_key
}

resource "digitalocean_droplet" "jalwa" {
  name       = var.project_name
  region     = var.region
  size       = var.droplet_size
  image      = var.droplet_image
  backups    = var.enable_backups
  monitoring = true
  ipv6       = true
  ssh_keys   = [digitalocean_ssh_key.jalwa.fingerprint]
  tags       = ["jalwa", "production", "web", "worker"]

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    ssh_public_key = var.ssh_public_key
    domain         = var.domain
  })
}

resource "digitalocean_firewall" "jalwa" {
  name        = "${var.project_name}-firewall"
  droplet_ids = [digitalocean_droplet.jalwa.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.admin_cidrs
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_project" "jalwa" {
  name        = var.project_name
  description = "Jalwa production web and media-processing infrastructure"
  purpose     = "Web Application"
  environment = "Production"
  resources   = [digitalocean_droplet.jalwa.urn]
}
