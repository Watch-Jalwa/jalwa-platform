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
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$BOOTSTRAP_SQL"

docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
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
  record="$(docker exec "$DB_CONTAINER" psql -At -F '|' -U "$DB_USER" -d "$DB_NAME" \
    -v filename="$filename" -c "select checksum,status from public.jalwa_schema_migrations where filename=:'filename';")"

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

  docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
    -v filename="$filename" -v checksum="$checksum" \
    -c "insert into public.jalwa_schema_migrations(filename,checksum,status,started_at,applied_at) values (:'filename',:'checksum','applying',now(),null);"

  echo "APPLY $filename"
  if ! docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$migration"; then
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
      -v filename="$filename" -c "update public.jalwa_schema_migrations set status='failed',error_message='psql execution failed' where filename=:'filename';" || true
    echo "Migration failed and was recorded for operator review: $filename" >&2
    exit 1
  fi

  docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
    -v filename="$filename" \
    -c "update public.jalwa_schema_migrations set status='applied',applied_at=now(),error_message=null where filename=:'filename' and status='applying';"
done

# Vanilla PostgreSQL does not install the table/sequence grants supplied by the former gateway stack.
# Mirror that role model while leaving function execution constrained by the explicit migration grants.
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger on all tables in schema public to anon, authenticated, service_role;
grant usage, select, update on all sequences in schema public to anon, authenticated, service_role;
SQL

echo "Database migrations are current."
