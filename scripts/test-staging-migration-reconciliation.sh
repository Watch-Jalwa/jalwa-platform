#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_WORKSPACE:=$(pwd)}"
: "${RUNNER_TEMP:=/tmp}"

db_container="$(docker ps --format '{{.ID}} {{.Image}}' | awk '$2 ~ /pgvector\/pgvector/ {print $1; exit}')"
test -n "$db_container" || { echo 'Could not locate the CI PostgreSQL service container.' >&2; docker ps; exit 1; }

current="$GITHUB_WORKSPACE/database/migrations/202609090004_public_live_catalogue_availability.sql"
historical="$GITHUB_WORKSPACE/database/migration-history/202609090004_public_live_catalogue_availability.staging-applied.sql"
successor="$GITHUB_WORKSPACE/database/migrations/202609090005_public_live_catalogue_availability_v2.sql"
historical_checksum="$(sha256sum "$historical" | awk '{print $1}')"
current_checksum="$(sha256sum "$current" | awk '{print $1}')"
test "$historical_checksum" != "$current_checksum"

tracking_sql() {
  local sql="$1"
  shift
  printf '%s\n' "$sql" | psql -X -v ON_ERROR_STOP=1 "$@"
}

tracking_sql \
  "update public.jalwa_schema_migrations set checksum=:'historical_checksum' where filename=:'filename' and status='applied'; delete from public.jalwa_schema_migrations where filename=:'successor';" \
  -v filename='202609090004_public_live_catalogue_availability.sql' \
  -v historical_checksum="$historical_checksum" \
  -v successor='202609090005_public_live_catalogue_availability_v2.sql' >/dev/null

ALLOW_STAGING_MIGRATION_090004_RECONCILIATION=true \
ALLOW_STAGING_RECONCILIATION_TEST_CONTAINER=true \
DEPLOYMENT_ENVIRONMENT=staging \
POSTGRES_USER=postgres \
POSTGRES_DB=postgres \
DB_CONTAINER="$db_container" \
CURRENT_MIGRATION="$current" \
HISTORICAL_MIGRATION="$historical" \
SUCCESSOR_MIGRATION="$successor" \
  bash infrastructure/production/scripts/reconcile-staging-migration-090004.sh \
  | tee "$RUNNER_TEMP/staging-090004-reconcile.log"

reconciled="$(tracking_sql \
  "select checksum,status from public.jalwa_schema_migrations where filename=:'filename';" \
  -At -F '|' -v filename='202609090004_public_live_catalogue_availability.sql')"
test "$reconciled" = "$current_checksum|applied"
grep -Fq 'Reconciled staging-only historical checksum' "$RUNNER_TEMP/staging-090004-reconcile.log"

POSTGRES_USER=postgres \
POSTGRES_DB=postgres \
DB_CONTAINER="$db_container" \
MIGRATIONS_DIR="$GITHUB_WORKSPACE/database/migrations" \
BOOTSTRAP_SQL="$GITHUB_WORKSPACE/database/bootstrap.sql" \
MIGRATION_LOCK_FILE="$RUNNER_TEMP/jalwa-migrations-after-staging-reconcile.lock" \
  bash infrastructure/production/scripts/apply-migrations.sh \
  | tee "$RUNNER_TEMP/migrations-after-staging-reconcile.log"
grep -Fq 'APPLY 202609090005_public_live_catalogue_availability_v2.sql' "$RUNNER_TEMP/migrations-after-staging-reconcile.log"

expected="$(find database/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
actual="$(psql -X -At -c "select count(*) from public.jalwa_schema_migrations where status='applied';")"
test "$actual" = "$expected"

tracking_sql \
  "update public.jalwa_schema_migrations set checksum=repeat('0',64) where filename=:'filename';" \
  -v filename='202609090004_public_live_catalogue_availability.sql' >/dev/null

if ALLOW_STAGING_MIGRATION_090004_RECONCILIATION=true \
   ALLOW_STAGING_RECONCILIATION_TEST_CONTAINER=true \
   DEPLOYMENT_ENVIRONMENT=staging \
   POSTGRES_USER=postgres \
   POSTGRES_DB=postgres \
   DB_CONTAINER="$db_container" \
   CURRENT_MIGRATION="$current" \
   HISTORICAL_MIGRATION="$historical" \
   SUCCESSOR_MIGRATION="$successor" \
     bash infrastructure/production/scripts/reconcile-staging-migration-090004.sh; then
  echo 'Unknown staging migration checksum was incorrectly accepted.' >&2
  exit 1
fi

tracking_sql \
  "update public.jalwa_schema_migrations set checksum=:'checksum' where filename=:'filename';" \
  -v filename='202609090004_public_live_catalogue_availability.sql' \
  -v checksum="$current_checksum" >/dev/null

echo 'Staging 090004 checksum reconciliation contract passed.'
