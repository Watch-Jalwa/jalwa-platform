#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_match() {
  local pattern="$1" file="$2" message="$3"
  grep -Fq -- "$pattern" "$file" || { echo "$message" >&2; exit 1; }
}
reject_match() {
  local pattern="$1" file="$2" message="$3"
  if grep -Fq -- "$pattern" "$file"; then echo "$message" >&2; exit 1; fi
}

for workflow in .github/workflows/bootstrap-staging.yml .github/workflows/bootstrap-platform.yml; do
  require_match 'GITHUB_ENV_ADMIN_TOKEN' "$workflow" "$workflow does not require the explicit environment-admin credential."
  require_match 'scripts/seed-environment-secrets.sh' "$workflow" "$workflow does not seed missing Jalwa-owned secrets."
  require_match 'scripts/with-digitalocean-ssh-access.sh' "$workflow" "$workflow does not grant temporary GitHub runner SSH access."
  require_match 'description: Optional persistent SSH CIDR' "$workflow" "$workflow still treats persistent SSH access as mandatory."
  require_match 'required: false' "$workflow" "$workflow does not make admin_cidr optional."
  require_match "admin_cidrs='[]'" "$workflow" "$workflow does not default to zero persistent SSH CIDRs."
  require_match '-var="admin_cidrs=$admin_cidrs"' "$workflow" "$workflow does not pass the computed optional CIDR list to Terraform."
  reject_match 'DIGITALOCEAN_SSH_PUBLIC_KEY' "$workflow" "$workflow still requires a separately managed DigitalOcean SSH public-key secret."
done

require_match 'default     = []' infrastructure/digitalocean/variables.tf 'Terraform admin_cidrs does not default to an empty list.'
require_match 'dynamic "inbound_rule"' infrastructure/digitalocean/main.tf 'Terraform does not conditionally create the persistent SSH rule.'
require_match 'for_each = length(var.admin_cidrs) > 0 ? [1] : []' infrastructure/digitalocean/main.tf 'Terraform persistent SSH rule is not omitted when no admin CIDR is supplied.'
require_match 'output "firewall_id"' infrastructure/digitalocean/outputs.tf 'Terraform does not expose the DigitalOcean firewall identity.'
require_match 'gh variable set STAGING_FIREWALL_ID' .github/workflows/bootstrap-staging.yml 'Staging bootstrap does not persist its firewall identity.'
require_match 'gh variable set PRODUCTION_FIREWALL_ID' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its firewall identity.'
require_match 'gh variable set R2_INCOMING_BUCKET' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its incoming R2 bucket.'
require_match 'gh variable set R2_PROCESSED_BUCKET' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its processed R2 bucket.'
require_match 'gh variable set R2_BACKUP_BUCKET' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its backup R2 bucket.'
require_match 'gh secret list' scripts/seed-environment-secrets.sh 'Secret seeding does not inspect existing secret names before writing.'
require_match 'has_secret "$name" || set_secret "$name" "$value"' scripts/seed-environment-secrets.sh 'Generated application secrets are not protected against rotation.'
require_match 'exists but was not exposed to this bootstrap job; refusing to rotate it.' scripts/seed-environment-secrets.sh 'SSH-key rotation fail-closed guard is missing.'

for workflow in .github/workflows/deploy-staging.yml .github/workflows/deploy-production.yml; do
  require_match 'DIGITALOCEAN_TOKEN' "$workflow" "$workflow cannot manage temporary runner firewall access."
  require_match 'scripts/with-digitalocean-ssh-access.sh' "$workflow" "$workflow does not wrap SSH access with a temporary firewall rule."
  require_match 'GHCR_USERNAME: ${{ github.actor }}' "$workflow" "$workflow does not use the run-scoped GitHub identity for GHCR."
  require_match 'GHCR_DEPLOY_TOKEN: ${{ github.token }}' "$workflow" "$workflow does not use the run-scoped GitHub package token for GHCR."
  reject_match 'GHCR_USERNAME: ${{ secrets.GHCR_USERNAME }}' "$workflow" "$workflow still requires a long-lived GHCR username secret."
  reject_match 'GHCR_DEPLOY_TOKEN: ${{ secrets.GHCR_DEPLOY_TOKEN }}' "$workflow" "$workflow still requires a long-lived GHCR deploy token."
done
require_match 'STAGING_FIREWALL_ID' .github/workflows/deploy-staging.yml 'Staging deploy does not require the persisted firewall identity.'
require_match 'PRODUCTION_FIREWALL_ID' .github/workflows/deploy-production.yml 'Production deploy does not require the persisted firewall identity.'
require_match '/v2/firewalls/$firewall_id/rules' scripts/with-digitalocean-ssh-access.sh 'Temporary firewall helper does not target the DigitalOcean rules endpoint.'
require_match '-X POST' scripts/with-digitalocean-ssh-access.sh 'Temporary firewall helper does not add the SSH rule.'
require_match '-X DELETE' scripts/with-digitalocean-ssh-access.sh 'Temporary firewall helper does not remove the SSH rule.'
require_match 'runner_cidr="$runner_ip/32"' scripts/with-digitalocean-ssh-access.sh 'Temporary firewall helper does not restrict runner access to a single IPv4 address.'

echo 'Bootstrap environment-admin, optional persistent SSH, temporary runner firewall and idempotent secret-seeding contract passed.'
