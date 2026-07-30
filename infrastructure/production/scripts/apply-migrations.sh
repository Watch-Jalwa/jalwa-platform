#!/usr/bin/env bash
set -Eeuo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/opt/jalwa/migrations}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_NAME="${POSTGRES_DB:-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migration directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null

docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
create table if not exists public.jalwa_schema_migrations (
  filename text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
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
  existing="$(docker exec "$DB_CONTAINER" psql -At -U "$DB_USER" -d "$DB_NAME" \
    -v filename="$filename" -c "select checksum from public.jalwa_schema_migrations where filename=:'filename';")"

  if [[ -n "$existing" ]]; then
    if [[ "$existing" != "$checksum" ]]; then
      echo "Applied migration checksum changed: $filename" >&2
      exit 1
    fi
    echo "SKIP $filename"
    continue
  fi

  echo "APPLY $filename"
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$migration"
  docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
    -v filename="$filename" -v checksum="$checksum" \
    -c "insert into public.jalwa_schema_migrations(filename,checksum) values (:'filename',:'checksum');"
done

echo "Database migrations are current."
