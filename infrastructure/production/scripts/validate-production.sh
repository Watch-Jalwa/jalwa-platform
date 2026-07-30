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
for key in SELF_HOSTED_POSTGRES_PASSWORD SELF_HOSTED_SUPABASE_JWT_SECRET SELF_HOSTED_SUPABASE_ANON_KEY SELF_HOSTED_SUPABASE_SERVICE_ROLE_KEY RECOMMENDATION_REFRESH_SECRET; do grep -q "^${key}=" /tmp/jalwa-self-hosted-secrets.env; done

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
for migration in 202607310001_social_recommendations.sql 202607310002_social_controls.sql 202607310003_semantic_recommendations.sql 202607310004_live_drm.sql 202607310005_community_reads.sql; do
  test -s "supabase/migrations/$migration" || { echo "Missing browser expansion migration: $migration" >&2; exit 1; }
done

grep -q 'SHAKA_PACKAGER_VERSION=3.7.2' Dockerfile || { echo 'Pinned Shaka Packager version is missing.' >&2; exit 1; }
grep -q '88b022b8cb12602ddb539972efd07a3496ea64f8662a484798c96e95afa41fd8' Dockerfile
grep -q 'e4a43aaa8fdb87d0306876bc41581b371d7082e9d1b8469aef06a4e74004fd69' Dockerfile
grep -q 'persistentState: "not-allowed"' apps/web/components/drm-player.tsx
grep -q 'rewritePlaylist' infrastructure/media-gateway/src/index.ts
if grep -n -E 'stream_key|srt_passphrase|content_key[[:space:]]+text' supabase/migrations/202607310004_live_drm.sql; then
  echo 'Live ingest secrets or plaintext DRM keys must not be stored in PostgreSQL.' >&2
  exit 1
fi

node --check apps/worker/src/index.mjs
node --check apps/worker/src/media.mjs
node --check apps/worker/src/drm.mjs

echo "Static production validation passed."
