# DigitalOcean Production Host

This Terraform module provisions one Ubuntu Droplet for the Jalwa web container, FFmpeg worker and Caddy reverse proxy. Supabase and Cloudflare R2 remain managed external services.

## Prerequisites

- Terraform 1.7+
- DigitalOcean API token
- an SSH public key
- a trusted office or VPN IP CIDR for SSH
- a selected DigitalOcean region slug

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
- a restricted cloud firewall;
- a DigitalOcean project;
- monitoring and optional Droplet backups;
- a non-root `jalwa` deployment user;
- Docker, Compose, PostgreSQL client, unattended upgrades and fail2ban;
- `/opt/jalwa` for production files.

## After apply

1. Put the returned host and `jalwa` username in the GitHub `production` environment secrets.
2. Point `watch-jalwa.com` and `www.watch-jalwa.com` to the returned IPv4 address through Cloudflare DNS.
3. Create `/opt/jalwa/.env.production` from `infrastructure/production/.env.production.example`.
4. Apply Supabase migrations.
5. Run the production deployment workflow.
6. Verify `/api/health` and `/api/readiness`.

## State safety

Terraform state contains infrastructure identifiers and can include sensitive values. Store it in an encrypted, access-controlled backend before team use. Do not commit `terraform.tfstate`, `.terraform/` or `terraform.tfvars`.
