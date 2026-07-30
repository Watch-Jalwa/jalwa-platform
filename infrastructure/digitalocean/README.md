# DigitalOcean Production Host

This Terraform module provisions one Ubuntu Droplet for the Jalwa web container, FFmpeg worker, Caddy and the official self-hosted Supabase/PostgreSQL Docker stack.

## Capacity

The default is `s-4vcpu-8gb`. Supabase documents 4 cores and 8 GB or more as the recommended baseline for its complete self-hosted stack. Use a separate worker host later if video processing begins to compete with database traffic.

## Prerequisites

- Terraform 1.7+
- DigitalOcean API token
- an SSH public key
- a trusted office or VPN IP CIDR for SSH
- a selected DigitalOcean region slug
- Cloudflare account and R2 credentials

## Provision

```bash
cd infrastructure/digitalocean
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars. Never commit it.
export TF_VAR_digitalocean_token='...'
terraform init
terraform fmt -check
terraform validate
terraform plan
terraform apply
```

Terraform creates:

- an Ubuntu Droplet;
- a restricted cloud firewall exposing only SSH, HTTP and HTTPS;
- monitoring and optional Droplet backups;
- a non-root `jalwa` deployment user;
- Docker, Compose, AWS CLI, PostgreSQL client, unattended upgrades and fail2ban;
- Docker log rotation and conservative host hardening;
- `/opt/jalwa` directories for application, database, migrations and backups.

## Deployment model

The GitHub workflows:

1. provision the host and DNS;
2. install an immutable official Supabase Docker revision;
3. generate the runtime configuration from GitHub environment secrets;
4. apply checksum-tracked SQL migrations;
5. build and deploy the Jalwa containers;
6. deploy the media Worker to its Cloudflare custom domain;
7. run smoke tests and an initial off-site PostgreSQL backup.

Postgres and Supabase ports are blocked by the DigitalOcean firewall. Public clients reach only the allow-listed Auth/REST routes at `api.<domain>` through Caddy. Studio remains available only through an SSH tunnel to `127.0.0.1:8000`.

## State safety

Terraform state contains infrastructure identifiers and can include sensitive values. Store it in the encrypted, access-controlled R2 backend configured by the bootstrap workflow. Never commit `terraform.tfstate`, `.terraform/` or `terraform.tfvars`.
