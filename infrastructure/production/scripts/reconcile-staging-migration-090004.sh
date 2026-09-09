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

[[ "$DB_CONTAINER" == "jalwa-postgres-staging" ]] || { echo "Refusing reconciliation against non-staging database container: $DB_CONTAINER" >&2; exit 1; }
[[ -f "$CURRENT_MIGRATION" ]] || { echo "Current migration file is missing." >&2; exit 1; }
[[ -f "$HISTORICAL_MIGRATION" ]] || { echo "Historical migration evidence is missing." >&2; exit 1; }
[[ -f "$SUCCESSOR_MIGRATION" ]] || { echo "Forward successor migration is missing." >&2; exit 1; }
[[ "$(basename "$CURRENT_MIGRATION")" == "$FILENAME" ]] || { echo "Unexpected current migration filename." >&2; exit 1; }
[[ "$(basename "$SUCCESSOR_MIGRATION")" == "202609090005_public_live_catalogue_availability_v2.sql" ]] || { echo "Unexpected successor migration filename." >&2; exit 1; }

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

record="$(printf '%s\n' "select checksum,status from public.jalwa_schema_migrations where filename=:'filename';" \
  | docker exec -i "$DB_CONTAINER" psql -X -At -F '|' -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -v filename="$FILENAME")"

if [[ -z "$record" ]]; then
  echo "No historical staging ledger row for $FILENAME; normal migration runner will apply the current migration."
  exit 0
fi

existing_checksum="${record%%|*}"
existing_status="${record#*|}"
if [[ "$existing_checksum" == "$current_checksum" && "$existing_status" == "applied" ]]; then
  echo "Staging migration ledger already uses the current $FILENAME checksum."
  exit 0
fi

[[ "$existing_status" == "applied" ]] || { echo "Refusing reconciliation because $FILENAME status is $existing_status." >&2; exit 1; }
[[ "$existing_checksum" == "$historical_checksum" ]] || {
  echo "Refusing reconciliation: staging ledger checksum is neither the preserved historical checksum nor the current checksum." >&2
  exit 1
}

# The historical staging-only migration completed only after these governance
# objects existed. Re-check the durable sentinels before reconciling its checksum.
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
  IF to_regprocedure('public.is_content_effectively_available(uuid)') IS NULL THEN
    RAISE EXCEPTION 'historical availability function sentinel is missing';
  END IF;
  SELECT count(*) INTO v_manifest FROM public.approved_live_catalogue_manifest;
  IF v_manifest <> 52 THEN
    RAISE EXCEPTION 'approved live manifest must contain exactly 52 entries, found %', v_manifest;
  END IF;
END
$$;
SQL

printf '%s\n' \
  "update public.jalwa_schema_migrations set checksum=:'current_checksum', error_message=null where filename=:'filename' and checksum=:'historical_checksum' and status='applied';" \
  | docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
      -v filename="$FILENAME" -v current_checksum="$current_checksum" -v historical_checksum="$historical_checksum" >/dev/null

reconciled="$(printf '%s\n' "select checksum,status from public.jalwa_schema_migrations where filename=:'filename';" \
  | docker exec -i "$DB_CONTAINER" psql -X -At -F '|' -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -v filename="$FILENAME")"
[[ "$reconciled" == "$current_checksum|applied" ]] || { echo "Staging migration checksum reconciliation did not converge." >&2; exit 1; }

echo "Reconciled staging-only historical checksum for $FILENAME; forward migration 090005 must now reapply the corrected availability predicate."
