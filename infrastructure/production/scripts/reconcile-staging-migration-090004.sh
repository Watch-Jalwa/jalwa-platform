#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${ALLOW_STAGING_MIGRATION_090004_RECONCILIATION:-false}" != "true" ]]; then
  echo "Staging migration 090004 reconciliation is disabled." >&2
  exit 1
fi
if [[ "${DEPLOYMENT_ENVIRONMENT:-}" != "staging" ]]; then
  echo "Migration 090004 reconciliation is staging-only." >&2
  exit 1
fi

DB_CONTAINER="${DB_CONTAINER:-jalwa-postgres-staging}"
CURRENT_MIGRATION="${CURRENT_MIGRATION:-}"
HISTORICAL_MIGRATION="${HISTORICAL_MIGRATION:-}"
SUCCESSOR_MIGRATION="${SUCCESSOR_MIGRATION:-}"
FILENAME="202609090004_public_live_catalogue_availability.sql"
SUCCESSOR_FILENAME="202609090005_public_live_catalogue_availability_v2.sql"

if [[ "$DB_CONTAINER" != "jalwa-postgres-staging" && "${ALLOW_STAGING_RECONCILIATION_TEST_CONTAINER:-false}" != "true" ]]; then
  echo "Refusing reconciliation against non-staging database container: $DB_CONTAINER" >&2
  exit 1
fi
[[ -f "$CURRENT_MIGRATION" ]] || { echo "Current migration file is missing." >&2; exit 1; }
[[ -f "$HISTORICAL_MIGRATION" ]] || { echo "Historical migration evidence is missing." >&2; exit 1; }
[[ -f "$SUCCESSOR_MIGRATION" ]] || { echo "Forward successor migration is missing." >&2; exit 1; }
[[ "$(basename "$CURRENT_MIGRATION")" == "$FILENAME" ]] || { echo "Unexpected current migration filename." >&2; exit 1; }
[[ "$(basename "$SUCCESSOR_MIGRATION")" == "$SUCCESSOR_FILENAME" ]] || { echo "Unexpected successor migration filename." >&2; exit 1; }

DB_USER="${POSTGRES_USER:-}"
DB_NAME="${POSTGRES_DB:-}"
if [[ -z "$DB_USER" ]]; then
  DB_USER="$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "${POSTGRES_USER:-}"')"
fi
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "${POSTGRES_DB:-}"')"
fi
: "${DB_USER:?Could not determine PostgreSQL user}"
: "${DB_NAME:?Could not determine PostgreSQL database}"

docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null

historical_checksum="$(sha256sum "$HISTORICAL_MIGRATION" | awk '{print $1}')"
current_checksum="$(sha256sum "$CURRENT_MIGRATION" | awk '{print $1}')"
[[ "$historical_checksum" =~ ^[0-9a-f]{64}$ ]]
[[ "$current_checksum" =~ ^[0-9a-f]{64}$ ]]
[[ "$historical_checksum" != "$current_checksum" ]] || { echo "Historical and current migration checksums unexpectedly match." >&2; exit 1; }

run_tracking_sql() {
  local sql="$1"
  shift
  printf '%s\n' "$sql" | docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

record="$(run_tracking_sql \
  "select checksum,status,coalesce(error_message,'') from public.jalwa_schema_migrations where filename=:'filename';" \
  -At -F '|' -v filename="$FILENAME")"

if [[ -z "$record" ]]; then
  echo "No staging ledger row for $FILENAME; normal migration runner will apply the current migration."
  exit 0
fi

IFS='|' read -r existing_checksum existing_status existing_error <<<"$record"
if [[ "$existing_checksum" == "$current_checksum" && "$existing_status" == "applied" ]]; then
  echo "Staging migration ledger already uses the current $FILENAME checksum."
  exit 0
fi

[[ "$existing_checksum" == "$historical_checksum" ]] || {
  echo "Refusing reconciliation: $FILENAME checksum does not match the exact preserved failed staging migration." >&2
  exit 1
}
[[ "$existing_status" == "failed" ]] || {
  echo "Refusing reconciliation because $FILENAME status is $existing_status; only the exact failed historical state may be retried." >&2
  exit 1
}
[[ "$existing_error" == "psql execution failed" ]] || {
  echo "Refusing reconciliation because $FILENAME has an unexpected failure marker." >&2
  exit 1
}

predecessors="$(run_tracking_sql \
  "select count(*) from public.jalwa_schema_migrations where filename in ('202609090001_public_catalogue_launch.sql','202609090002_nasa_public_availability.sql','202609090003_public_live_source_lookup.sql') and status='applied';" \
  -At)"
[[ "$predecessors" == "3" ]] || { echo "Refusing reconciliation because 090001-090003 are not all applied." >&2; exit 1; }

successor_record="$(run_tracking_sql \
  "select status from public.jalwa_schema_migrations where filename=:'filename';" \
  -At -v filename="$SUCCESSOR_FILENAME")"
[[ -z "$successor_record" ]] || { echo "Refusing reconciliation because $SUCCESSOR_FILENAME already has a ledger row." >&2; exit 1; }

# The failed historical migration was transactional, so its failed row does not
# prove its schema/data changes committed. Verify only predecessor governance
# sentinels, then remove the exact failed row so the normal runner executes the
# current 090004 and forward 090005 from scratch.
docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
DO $$
DECLARE
  v_manifest integer;
BEGIN
  IF to_regclass('public.approved_live_catalogue_manifest') IS NULL THEN
    RAISE EXCEPTION 'approved live catalogue manifest is missing';
  END IF;
  IF to_regclass('public.live_source_configs') IS NULL OR to_regclass('public.playback_sources') IS NULL THEN
    RAISE EXCEPTION 'live catalogue governance tables are missing';
  END IF;
  SELECT count(*) INTO v_manifest FROM public.approved_live_catalogue_manifest;
  IF v_manifest <> 52 THEN
    RAISE EXCEPTION 'approved live manifest must contain exactly 52 entries, found %', v_manifest;
  END IF;
END
$$;
SQL

run_tracking_sql \
  "delete from public.jalwa_schema_migrations where filename=:'filename' and checksum=:'historical_checksum' and status='failed' and error_message='psql execution failed';" \
  -v filename="$FILENAME" -v historical_checksum="$historical_checksum" >/dev/null

remaining="$(run_tracking_sql \
  "select count(*) from public.jalwa_schema_migrations where filename=:'filename';" \
  -At -v filename="$FILENAME")"
[[ "$remaining" == "0" ]] || { echo "Failed staging migration row was not removed exactly." >&2; exit 1; }

echo "Cleared exact failed historical staging row for $FILENAME; normal migration runner must now execute current 090004 and forward 090005."
