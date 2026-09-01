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
node --check scripts/verify-release-identity.mjs
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
  DOMAIN=example.com \
    JALWA_IMAGE_TAG=0000000000000000000000000000000000000000 \
    JALWA_WEB_IMAGE=ghcr.io/watch-jalwa/jalwa-platform-web:0000000000000000000000000000000000000000 \
    JALWA_WORKER_IMAGE=ghcr.io/watch-jalwa/jalwa-platform-worker:0000000000000000000000000000000000000000 \
    docker compose config --quiet
)
require_match '${POSTGRES_IMAGE:-pgvector/pgvector:pg17}' infrastructure/production/docker-compose.yml 'Pgvector-capable PostgreSQL service is missing.'
require_match 'container_name: jalwa-postgres' infrastructure/production/docker-compose.yml 'Stable PostgreSQL container identity is missing.'
require_match '${JALWA_WEB_IMAGE:-ghcr.io/watch-jalwa/jalwa-platform-web:latest}' infrastructure/production/docker-compose.yml 'Web service does not accept an exact promoted image reference.'
require_match '${JALWA_WORKER_IMAGE:-ghcr.io/watch-jalwa/jalwa-platform-worker:latest}' infrastructure/production/docker-compose.yml 'Worker service does not accept an exact promoted image reference.'
require_match 'server-managed staging environment' .github/workflows/deploy-staging.yml 'Staging does not preserve the on-prem server-managed environment.'
require_match 'required=(DEPLOYMENT_ENVIRONMENT DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL' .github/workflows/deploy-staging.yml 'Staging does not require direct PostgreSQL and Better Auth runtime configuration.'
require_match 'upsert_env MEDIA_BACKEND r2' .github/workflows/deploy-staging.yml 'Staging R2 media boundary is missing.'
require_match 'upsert_env TRANSCODE_BACKEND ffmpeg' .github/workflows/deploy-staging.yml 'Staging FFmpeg transcode boundary is missing.'
require_match 'upsert_env MEDIA_GATEWAY_MODE same-origin' .github/workflows/deploy-staging.yml 'Staging same-origin media gateway boundary is missing.'
require_match 'upsert_env PAYMENT_PROVIDER mock' .github/workflows/deploy-staging.yml 'Staging mock payment boundary is missing.'
require_match 'upsert_env ALLOW_MOCK_PAYMENTS true' .github/workflows/deploy-staging.yml 'Staging mock payment allow flag is missing.'
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
require_match 'rewritePlaylist' infrastructure/media-gateway/src/index.ts 'Legacy media gateway signed HLS playlist rewriting is missing.'
require_match 'MEDIA_GATEWAY_ALLOWED_ORIGINS' infrastructure/media-gateway/src/index.ts 'Legacy media gateway origin allow-list is missing.'
require_match 'rewriteHlsPlaylist' apps/web/lib/media/gateway.mjs 'Same-origin media gateway signed HLS rewriting is missing.'
require_match 'normalizeMediaPath' apps/web/lib/media/gateway.mjs 'Same-origin media path validation is missing.'
require_match 'verifyPlaybackToken' 'apps/web/app/api/media/[...path]/route.ts' 'Same-origin media route does not verify signed playback tokens.'
require_match 'getProcessedObject' apps/web/lib/media/storage.ts 'Web runtime cannot read private processed R2 media.'
require_match 'MEDIA_GATEWAY_MODE same-origin' .github/workflows/deploy-staging.yml 'On-prem staging does not select the same-origin media gateway.'
require_match 'WORKER_HEARTBEAT_PATH' infrastructure/production/docker-compose.yml 'Worker heartbeat health check is missing.'
require_match 'BACKUP_REASON=pre-migration' .github/workflows/deploy-production.yml 'Pre-migration backup is missing.'
require_match 'deploy-release.sh' .github/workflows/deploy-production.yml 'Transactional release deployment is missing.'
require_match 'PRODUCTION_SSH_KNOWN_HOSTS' .github/workflows/deploy-production.yml 'Pinned production SSH identity is missing.'
require_match 'certification_run_id:' .github/workflows/deploy-production.yml 'Production does not require retained staging certification evidence.'
require_match 'payment_sandbox_run_id:' .github/workflows/deploy-production.yml 'Production does not require real-provider sandbox evidence.'
require_match 'uat_approval_reference:' .github/workflows/deploy-production.yml 'Production does not require a human UAT reference.'
require_match 'READY FOR UAT' .github/workflows/deploy-production.yml 'Production does not validate the READY FOR UAT decision.'
require_match '.services.web.repo_digest' .github/workflows/deploy-production.yml 'Production does not promote the certified web digest.'
require_match '.services.worker.repo_digest' .github/workflows/deploy-production.yml 'Production does not promote the certified worker digest.'
require_match "docker pull '\$JALWA_WEB_IMAGE'" .github/workflows/deploy-production.yml 'Production does not pre-pull the certified web digest.'
require_match "docker pull '\$JALWA_WORKER_IMAGE'" .github/workflows/deploy-production.yml 'Production does not pre-pull the certified worker digest.'
if grep -Fq 'docker/build-push-action@' .github/workflows/deploy-production.yml || grep -Fq 'docker/setup-buildx-action@' .github/workflows/deploy-production.yml; then
  echo 'Production must promote staging-certified image digests and must not rebuild application images.' >&2
  exit 1
fi
require_match 'Payment provider sandbox certification' .github/workflows/deploy-production.yml 'Production does not validate real-provider sandbox evidence.'
require_match 'signed_webhook_lifecycle == "succeeded"' .github/workflows/deploy-production.yml 'Production does not require a successful signed provider lifecycle.'
require_match "mock|'')" .github/workflows/payment-sandbox-certification.yml 'The payment sandbox gate does not reject mock.'
require_match 'STAGING_PAYMENT_EXPECTED_HOST' .github/workflows/payment-sandbox-certification.yml 'The provider sandbox redirect host is not pinned.'
require_match 'capture-release-identity.sh' .github/workflows/deploy-production.yml 'Production does not capture running release identity.'
require_match 'build_pipeline_id' infrastructure/production/scripts/capture-release-identity.sh 'Release identity does not retain image build provenance.'
require_match 'deployment_pipeline_id' infrastructure/production/scripts/capture-release-identity.sh 'Release identity does not retain deployment provenance.'
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
node --check apps/web/lib/media/gateway.mjs
node --check apps/web/public/sw.js
node --check infrastructure/aws-media/lambda/submit-mediaconvert.mjs
node --check infrastructure/aws-media/lambda/complete-mediaconvert.mjs

echo "Static production validation passed."
