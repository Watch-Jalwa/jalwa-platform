#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

for script in infrastructure/production/scripts/*.sh; do bash -n "$script"; done

if grep -R -n -E 'SUPABASE_ACCESS_TOKEN|api\.supabase\.com/v1/projects|supabase projects create' .github/workflows infrastructure/production --exclude='validate-production.sh'; then
  echo "Managed Supabase provisioning references remain in production paths." >&2
  exit 1
fi

node --check scripts/generate-supabase-secrets.mjs
node --check scripts/launch-catalogue.mjs
node --check scripts/import-launch-catalogue.mjs
node scripts/launch-catalogue.mjs content/launch-catalogue.example.jsonl --min=2 --allow-placeholders >/tmp/jalwa-catalogue-validation.json
jq -e '.ok == true and .summary.items == 2' /tmp/jalwa-catalogue-validation.json >/dev/null

node scripts/generate-supabase-secrets.mjs > /tmp/jalwa-self-hosted-secrets.env
for key in SELF_HOSTED_POSTGRES_PASSWORD SELF_HOSTED_SUPABASE_JWT_SECRET SELF_HOSTED_SUPABASE_ANON_KEY SELF_HOSTED_SUPABASE_SERVICE_ROLE_KEY; do grep -q "^${key}=" /tmp/jalwa-self-hosted-secrets.env; done

cp infrastructure/production/.env.production.example infrastructure/production/.env.production
trap 'rm -f infrastructure/production/.env.production /tmp/jalwa-self-hosted-secrets.env /tmp/jalwa-catalogue-validation.json' EXIT
(
  cd infrastructure/production
  DOMAIN=example.com JALWA_IMAGE_TAG=ci docker compose config --quiet
)

mapfile -t migrations < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
(( ${#migrations[@]} > 0 ))
for migration in "${migrations[@]}"; do
  [[ "$migration" =~ ^[0-9]{12,}_[a-z0-9_]+\.sql$ ]] || { echo "Invalid migration filename: $migration" >&2; exit 1; }
done

echo "Static production validation passed."
