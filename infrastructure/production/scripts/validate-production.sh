#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

require_match() {
  local pattern="$1" file="$2" message="$3"
  grep -Fq -- "$pattern" "$file" || { echo "$message" >&2; exit 1; }
}

require_count() {
  local expected="$1" pattern="$2" file="$3" message="$4"
  local actual
  actual="$(grep -Fc -- "$pattern" "$file" || true)"
  [[ "$actual" == "$expected" ]] || { echo "$message (expected $expected, found $actual)" >&2; exit 1; }
}

echo "Checking shell scripts"
for script in infrastructure/production/scripts/*.sh; do bash -n "$script"; done

if grep -R -n -E 'SUPABASE_ACCESS_TOKEN|api\.supabase\.com/v1/projects|supabase projects create' .github/workflows infrastructure/production --exclude='validate-production.sh'; then
  echo "Managed Supabase provisioning references remain in production paths." >&2
  exit 1
fi
if grep -Fq 'ssh-keyscan -H "$HOST"' .github/workflows/deploy-production.yml; then
  echo 'Production deployment must use pinned SSH host keys, not trust-on-first-use.' >&2
  exit 1
fi
if grep -E 'uses: (docker|cloudflare)/[^@]+@v[0-9]+' .github/workflows/deploy-production.yml; then
  echo 'Production deployment contains mutable third-party action tags.' >&2
  exit 1
fi
if grep -R -n -E '^  contents: write$' .github/workflows; then
  echo 'Repository workflows must not retain general contents:write permission.' >&2
  exit 1
fi

echo "Checking JavaScript utilities and generated secrets"
node --check scripts/generate-supabase-secrets.mjs
node --check scripts/launch-catalogue.mjs
node --check scripts/import-launch-catalogue.mjs
node scripts/launch-catalogue.mjs content/launch-catalogue.example.jsonl --min=2 --allow-placeholders >/tmp/jalwa-catalogue-validation.json
jq -e '.ok == true and .summary.items == 2' /tmp/jalwa-catalogue-validation.json >/dev/null
node scripts/generate-supabase-secrets.mjs > /tmp/jalwa-self-hosted-secrets.env
for key in \
  SELF_HOSTED_POSTGRES_PASSWORD SELF_HOSTED_SUPABASE_JWT_SECRET SELF_HOSTED_SUPABASE_ANON_KEY \
  SELF_HOSTED_SUPABASE_SERVICE_ROLE_KEY RECOMMENDATION_REFRESH_SECRET CRON_SECRET \
  ACCOUNT_REQUEST_PROCESSOR_SECRET ACCOUNT_DELETION_HASH_SECRET; do
  grep -q "^${key}=" /tmp/jalwa-self-hosted-secrets.env || { echo "Generated secret missing: $key" >&2; exit 1; }
done

echo "Checking production Compose configuration"
cp infrastructure/production/.env.production.example infrastructure/production/.env.production
trap 'rm -f infrastructure/production/.env.production /tmp/jalwa-self-hosted-secrets.env /tmp/jalwa-catalogue-validation.json' EXIT
(
  cd infrastructure/production
  DOMAIN=example.com JALWA_IMAGE_TAG=ci docker compose config --quiet
)

echo "Checking migration inventory"
mapfile -t migrations < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
(( ${#migrations[@]} > 0 )) || { echo 'No migrations found.' >&2; exit 1; }
for migration in "${migrations[@]}"; do
  [[ "$migration" =~ ^[0-9]{12,}_[a-z0-9_]+\.sql$ ]] || { echo "Invalid migration filename: $migration" >&2; exit 1; }
done
for migration in \
  202607310001_social_recommendations.sql 202607310002_social_controls.sql \
  202607310003_semantic_recommendations.sql 202607310004_live_drm.sql \
  202607310005_community_reads.sql 202607310006_social_live_hardening.sql \
  202607310007_production_integrity.sql 202607310008_privacy_operations.sql \
  202607310009_privacy_export.sql; do
  test -s "supabase/migrations/$migration" || { echo "Missing production migration: $migration" >&2; exit 1; }
done

echo "Checking runtime and database controls"
require_match 'SHAKA_PACKAGER_VERSION=3.7.2' Dockerfile 'Pinned Shaka Packager version is missing.'
require_match '88b022b8cb12602ddb539972efd07a3496ea64f8662a484798c96e95afa41fd8' Dockerfile 'AMD64 Shaka checksum is missing.'
require_match 'e4a43aaa8fdb87d0306876bc41581b371d7082e9d1b8469aef06a4e74004fd69' Dockerfile 'ARM64 Shaka checksum is missing.'
require_count 2 'USER node' Dockerfile 'Web and worker runtime images must run as node.'
require_match 'persistentState: "not-allowed"' apps/web/components/drm-player.tsx 'Persistent browser DRM sessions must remain disabled.'
require_match 'rewritePlaylist' infrastructure/media-gateway/src/index.ts 'Signed HLS playlist rewriting is missing.'
require_match 'MEDIA_GATEWAY_ALLOWED_ORIGINS' infrastructure/media-gateway/src/index.ts 'Media origin allow-list is missing.'
require_match 'revoke insert,update,delete on public.comments' supabase/migrations/202607310006_social_live_hardening.sql 'Direct comment table writes are not revoked.'
require_match 'revoke insert, update, delete on public.checkout_orders' supabase/migrations/202607310007_production_integrity.sql 'Direct checkout writes are not revoked.'
require_match 'revoke all on function public.claim_media_job' supabase/migrations/202607310007_production_integrity.sql 'Media job claim function is exposed.'
require_match 'create or replace function public.store_ai_exchange' supabase/migrations/202607310007_production_integrity.sql 'Controlled AI exchange storage is missing.'
require_match 'create or replace function public.claim_account_request' supabase/migrations/202607310008_privacy_operations.sql 'Privacy request queue is missing.'
require_match 'create or replace function public.build_account_export' supabase/migrations/202607310009_privacy_export.sql 'Account export function is missing.'
if grep -n -E 'stream_key|srt_passphrase|content_key[[:space:]]+text' supabase/migrations/202607310004_live_drm.sql; then
  echo 'Live ingest secrets or plaintext DRM keys must not be stored in PostgreSQL.' >&2
  exit 1
fi

require_match 'R2_INCOMING_BUCKET' apps/web/lib/media/storage.ts 'Incoming R2 bucket is not configured in the web upload path.'
require_match 'bucket("processed")' apps/worker/src/media.mjs 'Processed output bucket is not used by the media worker.'
require_match 'downloadObject(asset.storage_key, source, "incoming")' apps/worker/src/media.mjs 'Media worker does not read uploaded sources from the incoming bucket.'
require_match 'protocol_whitelist' apps/worker/src/media.mjs 'Media protocol isolation is missing.'
require_match 'WORKER_HEARTBEAT_PATH' infrastructure/production/docker-compose.yml 'Worker heartbeat health check is missing.'
require_match 'request.mode === "navigate"' apps/web/public/sw.js 'Navigation cache policy is missing.'
require_match 'fetch(request, { cache: "no-store" })' apps/web/public/sw.js 'Navigations are not network-only.'
require_match 'BACKUP_REASON=pre-migration' .github/workflows/deploy-production.yml 'Pre-migration backup is missing.'
require_match 'deploy-release.sh' .github/workflows/deploy-production.yml 'Transactional release deployment is missing.'
require_match 'PRODUCTION_SSH_KNOWN_HOSTS' .github/workflows/deploy-production.yml 'Pinned production SSH identity is missing.'
require_match 'docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c' .github/workflows/deploy-production.yml 'Buildx action is not pinned.'
require_match 'docker/login-action@dbcb813823bdd20940b903addbd779551569679f' .github/workflows/deploy-production.yml 'Registry login action is not pinned.'
require_count 2 'docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a' .github/workflows/deploy-production.yml 'Image build actions are not pinned.'
require_match 'cloudflare/wrangler-action@ebbaa1584979971c8614a24965b4405ff95890e0' .github/workflows/deploy-production.yml 'Cloudflare deployment action is not pinned.'
require_count 2 'provenance: mode=max' .github/workflows/deploy-production.yml 'Image provenance is not enabled for both images.'
require_count 2 'sbom: true' .github/workflows/deploy-production.yml 'Image SBOM attestations are not enabled for both images.'
require_match 'restore-drill.sh' .github/workflows/deploy-production.yml 'Deployment does not rehearse database restoration.'
require_match 'host-acceptance.sh' .github/workflows/deploy-production.yml 'Deployment does not enforce host acceptance.'
require_match 'Content-Security-Policy-Report-Only' infrastructure/production/Caddyfile 'CSP reporting policy is missing.'
require_match 'jalwa-restore-drill.timer' infrastructure/production/scripts/install-operations.sh 'Restore drill timer is not installed.'
require_match 'jalwa-account-requests.timer' infrastructure/production/scripts/install-operations.sh 'Privacy processor timer is not installed.'
require_match "status='applying'" infrastructure/production/scripts/apply-migrations.sh 'Migration applying-state tracking is missing.'

echo "Checking runtime JavaScript syntax"
node --check apps/worker/src/index.mjs
node --check apps/worker/src/media.mjs
node --check apps/worker/src/drm.mjs
node --check apps/web/public/sw.js

echo "Static production validation passed."
