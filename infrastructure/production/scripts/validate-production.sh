#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

require_match() {
  local pattern="$1" file="$2" message="$3"
  grep -Fq -- "$pattern" "$file" || { echo "$message" >&2; exit 1; }
}
require_count() {
  local expected="$1" pattern="$2" file="$3" message="$4" actual
  actual="$(grep -Fc -- "$pattern" "$file" || true)"
  [[ "$actual" == "$expected" ]] || { echo "$message (expected $expected, found $actual)" >&2; exit 1; }
}

echo "Checking shell scripts"
for script in infrastructure/production/scripts/*.sh scripts/test-production-*.sh scripts/test-*-readiness.sh; do bash -n "$script"; done

if grep -Fq 'ssh-keyscan' .github/workflows/deploy-production.yml .github/workflows/deploy-staging.yml; then
  echo 'Deployment workflows must use pinned SSH host keys, not trust-on-first-use.' >&2
  exit 1
fi
if grep -E 'uses: (docker|cloudflare)/[^@]+@v[0-9]+' .github/workflows/deploy-production.yml .github/workflows/deploy-staging.yml; then
  echo 'Deployment workflows contain mutable third-party action tags.' >&2
  exit 1
fi
if grep -R -n -E '^  contents: write$' .github/workflows; then
  echo 'Repository workflows must not retain general contents:write permission.' >&2
  exit 1
fi

echo "Checking JavaScript utilities and generated secrets"
node --check scripts/generate-database-secrets.mjs
node --check scripts/launch-catalogue.mjs
node --check scripts/import-launch-catalogue.mjs
node --check scripts/harvest-alpha-open-content.mjs
node scripts/launch-catalogue.mjs content/launch-catalogue.example.jsonl --min=2 --allow-placeholders >/tmp/jalwa-catalogue-validation.json
jq -e '.ok == true and .summary.items == 2' /tmp/jalwa-catalogue-validation.json >/dev/null
node scripts/generate-database-secrets.mjs > /tmp/jalwa-self-hosted-secrets.env
for key in \
  SELF_HOSTED_POSTGRES_PASSWORD BETTER_AUTH_SECRET STAGING_QA_SECRET MEDIA_SIGNING_SECRET \
  RATE_LIMIT_SALT OBSERVABILITY_HASH_SALT OPERATIONS_DIAGNOSTICS_SECRET \
  RECOMMENDATION_REFRESH_SECRET CRON_SECRET ACCOUNT_REQUEST_PROCESSOR_SECRET ACCOUNT_DELETION_HASH_SECRET; do
  grep -q "^${key}=" /tmp/jalwa-self-hosted-secrets.env || { echo "Generated secret missing: $key" >&2; exit 1; }
done

echo "Checking production Compose configuration"
cp infrastructure/production/.env.production.example infrastructure/production/.env.production
trap 'rm -f infrastructure/production/.env.production /tmp/jalwa-self-hosted-secrets.env /tmp/jalwa-catalogue-validation.json' EXIT
(
  cd infrastructure/production
  DOMAIN=example.com JALWA_IMAGE_TAG=0000000000000000000000000000000000000000 docker compose config --quiet
)
require_match 'postgres:17-alpine' infrastructure/production/docker-compose.yml 'Pinned PostgreSQL service is missing.'
require_match 'container_name: jalwa-postgres' infrastructure/production/docker-compose.yml 'Stable PostgreSQL container identity is missing.'
require_match 'DATABASE_URL=postgresql://postgres:' .github/workflows/deploy-staging.yml 'Staging does not use a direct PostgreSQL URL.'
require_match 'BETTER_AUTH_URL=https://$DOMAIN' .github/workflows/deploy-staging.yml 'Staging Better Auth URL is missing.'
require_match 'PAYMENT_PROVIDER=mock' .github/workflows/deploy-staging.yml 'Staging mock payment boundary is missing.'
require_match 'ALLOW_MOCK_PAYMENTS=true' .github/workflows/deploy-staging.yml 'Staging mock payment allow flag is missing.'
require_match 'ALLOW_MOCK_PAYMENTS=false' .github/workflows/deploy-production.yml 'Production mock payments must remain disabled.'

echo "Checking migration inventory"
mapfile -t migrations < <(find database/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
(( ${#migrations[@]} > 0 )) || { echo 'No migrations found.' >&2; exit 1; }
for migration in "${migrations[@]}"; do
  [[ "$migration" =~ ^[0-9]{12,}_[a-z0-9_]+\.sql$ ]] || { echo "Invalid migration filename: $migration" >&2; exit 1; }
done
for migration in \
  202607310001_social_recommendations.sql 202607310002_social_controls.sql \
  202607310003_semantic_recommendations.sql 202607310004_live_drm.sql \
  202607310005_community_reads.sql 202607310006_social_live_hardening.sql \
  202607310007_production_integrity.sql 202607310008_privacy_operations.sql \
  202607310009_privacy_export.sql 202607310010_payment_operations.sql \
  202608190001_better_auth.sql; do
  test -s "database/migrations/$migration" || { echo "Missing production migration: $migration" >&2; exit 1; }
done

echo "Checking runtime and database controls"
require_match 'SHAKA_PACKAGER_VERSION=3.7.2' Dockerfile 'Pinned Shaka Packager version is missing.'
require_count 2 'USER node' Dockerfile 'Web and worker runtime images must run as node.'
require_count 2 'HEALTHCHECK' Dockerfile 'Web and worker runtime images must declare health checks.'
require_match 'test-production-container.sh' .github/workflows/ci.yml 'CI does not boot and test the production web image.'
require_match 'persistentState: "not-allowed"' apps/web/components/drm-player.tsx 'Persistent browser DRM sessions must remain disabled.'
require_match 'rewritePlaylist' infrastructure/media-gateway/src/index.ts 'Signed HLS playlist rewriting is missing.'
require_match 'MEDIA_GATEWAY_ALLOWED_ORIGINS' infrastructure/media-gateway/src/index.ts 'Media origin allow-list is missing.'
require_match 'WORKER_HEARTBEAT_PATH' infrastructure/production/docker-compose.yml 'Worker heartbeat health check is missing.'
require_match 'BACKUP_REASON=pre-migration' .github/workflows/deploy-production.yml 'Pre-migration backup is missing.'
require_match 'deploy-release.sh' .github/workflows/deploy-production.yml 'Transactional release deployment is missing.'
require_match 'PRODUCTION_SSH_KNOWN_HOSTS' .github/workflows/deploy-production.yml 'Pinned production SSH identity is missing.'
require_match 'docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c' .github/workflows/deploy-production.yml 'Buildx action is not pinned.'
require_match 'docker/login-action@dbcb813823bdd20940b903addbd779551569679f' .github/workflows/deploy-production.yml 'Registry login action is not pinned.'
require_count 2 'docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a' .github/workflows/deploy-production.yml 'Image build actions are not pinned.'
require_count 2 'provenance: mode=max' .github/workflows/deploy-production.yml 'Image provenance is not enabled for both images.'
require_count 2 'sbom: true' .github/workflows/deploy-production.yml 'Image SBOM attestations are not enabled for both images.'
require_match 'restore-drill.sh' .github/workflows/deploy-production.yml 'Deployment does not rehearse database restoration.'
require_match 'host-acceptance.sh' .github/workflows/deploy-production.yml 'Deployment does not enforce host acceptance.'
require_match 'Content-Security-Policy-Report-Only' infrastructure/production/Caddyfile 'CSP reporting policy is missing.'
require_match 'jalwa-restore-drill.timer' infrastructure/production/scripts/install-operations.sh 'Restore drill timer is not installed.'
require_match "status='applying'" infrastructure/production/scripts/apply-migrations.sh 'Migration applying-state tracking is missing.'
require_match 'create table if not exists public."user"' database/migrations/202608190001_better_auth.sql 'Better Auth user schema is missing.'
require_match 'sync_better_auth_user' database/migrations/202608190001_better_auth.sql 'Better Auth identity mirror is missing.'

echo "Checking runtime JavaScript syntax"
node --check apps/worker/src/index.mjs
node --check apps/worker/src/media.mjs
node --check apps/worker/src/drm.mjs
node --check apps/web/public/sw.js
node --check infrastructure/aws-media/lambda/submit-mediaconvert.mjs
node --check infrastructure/aws-media/lambda/complete-mediaconvert.mjs

echo "Static production validation passed."
