#!/usr/bin/env bash
set -Eeuo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/opt/jalwa/migrations}"
BOOTSTRAP_SQL="${BOOTSTRAP_SQL:-/opt/jalwa/bootstrap.sql}"
DB_CONTAINER="${DB_CONTAINER:-jalwa-postgres}"
LOCK_FILE="${MIGRATION_LOCK_FILE:-/opt/jalwa/.migration.lock}"

DB_USER="${POSTGRES_USER:-}"
DB_NAME="${POSTGRES_DB:-}"
if [[ -z "$DB_USER" ]]; then
  DB_USER="$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "${POSTGRES_USER:-}"')"
fi
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "${POSTGRES_DB:-}"')"
fi
: "${DB_USER:?Could not determine PostgreSQL user from POSTGRES_USER or the running database container}"
: "${DB_NAME:?Could not determine PostgreSQL database from POSTGRES_DB or the running database container}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migration directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another database migration runner is active." >&2; exit 1; }
docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null

if [[ ! -f "$BOOTSTRAP_SQL" ]]; then
  echo "Database bootstrap file not found: $BOOTSTRAP_SQL" >&2
  exit 1
fi
docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$BOOTSTRAP_SQL"

docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
create table if not exists public.jalwa_schema_migrations (
  filename text primary key,
  checksum text not null,
  status text not null default 'applied' check (status in ('applying','applied','failed')),
  started_at timestamptz not null default now(),
  applied_at timestamptz,
  error_message text
);
alter table public.jalwa_schema_migrations add column if not exists status text not null default 'applied';
alter table public.jalwa_schema_migrations add column if not exists started_at timestamptz not null default now();
alter table public.jalwa_schema_migrations add column if not exists error_message text;
alter table public.jalwa_schema_migrations alter column applied_at drop not null;
update public.jalwa_schema_migrations set status='applied', applied_at=coalesce(applied_at,now()) where status is null;
SQL

# psql does not perform its :variable interpolation on SQL supplied through -c.
# Feed tracking statements over stdin so -v values are quoted by psql itself rather
# than interpolating migration filenames/checksums into SQL in the shell.
run_tracking_sql() {
  local sql="$1"
  shift
  printf '%s\n' "$sql" | docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if (( ${#migrations[@]} == 0 )); then
  echo "No migrations found." >&2
  exit 1
fi

for migration in "${migrations[@]}"; do
  filename="$(basename "$migration")"
  if [[ ! "$filename" =~ ^[0-9]{12,}_[a-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename: $filename" >&2
    exit 1
  fi
  checksum="$(sha256sum "$migration" | awk '{print $1}')"
  record="$(run_tracking_sql \
    "select checksum,status from public.jalwa_schema_migrations where filename=:'filename';" \
    -At -F '|' -v filename="$filename")"

  if [[ -n "$record" ]]; then
    existing_checksum="${record%%|*}"
    existing_status="${record#*|}"
    if [[ "$existing_checksum" != "$checksum" ]]; then
      echo "Applied migration checksum changed: $filename" >&2
      exit 1
    fi
    if [[ "$existing_status" == "applied" ]]; then
      echo "SKIP $filename"
      continue
    fi
    echo "Migration $filename is recorded as $existing_status. Resolve and explicitly update/delete its tracking row before retrying." >&2
    exit 1
  fi

  run_tracking_sql \
    "insert into public.jalwa_schema_migrations(filename,checksum,status,started_at,applied_at) values (:'filename',:'checksum','applying',now(),null);" \
    -v filename="$filename" -v checksum="$checksum" >/dev/null

  echo "APPLY $filename"
  if ! docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$migration"; then
    run_tracking_sql \
      "update public.jalwa_schema_migrations set status='failed',error_message='psql execution failed' where filename=:'filename';" \
      -v filename="$filename" >/dev/null || true
    echo "Migration failed and was recorded for operator review: $filename" >&2
    exit 1
  fi

  run_tracking_sql \
    "update public.jalwa_schema_migrations set status='applied',applied_at=now(),error_message=null where filename=:'filename' and status='applying';" \
    -v filename="$filename" >/dev/null
done

# bootstrap.sql establishes the runtime roles, schema usage and default privileges
# before migrations create objects. Individual migrations intentionally revoke and
# narrow privileges for sensitive tables/functions. Never re-grant blanket table
# DML here after migrations, because doing so would undo those security boundaries.

echo "Database migrations are current."
