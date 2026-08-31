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
  reject_match 'DIGITALOCEAN_SSH_PUBLIC_KEY' "$workflow" "$workflow still requires a separately managed DigitalOcean SSH public-key secret."
done

require_match 'gh variable set R2_INCOMING_BUCKET' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its incoming R2 bucket.'
require_match 'gh variable set R2_PROCESSED_BUCKET' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its processed R2 bucket.'
require_match 'gh variable set R2_BACKUP_BUCKET' .github/workflows/bootstrap-platform.yml 'Production bootstrap does not persist its backup R2 bucket.'
require_match 'gh secret list' scripts/seed-environment-secrets.sh 'Secret seeding does not inspect existing secret names before writing.'
require_match 'has_secret "$name" || set_secret "$name" "$value"' scripts/seed-environment-secrets.sh 'Generated application secrets are not protected against rotation.'
require_match 'exists but was not exposed to this bootstrap job; refusing to rotate it.' scripts/seed-environment-secrets.sh 'SSH-key rotation fail-closed guard is missing.'

echo 'Bootstrap environment-admin and idempotent secret-seeding contract passed.'
