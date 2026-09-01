#!/usr/bin/env bash
set -Eeuo pipefail

compose_file="${COMPOSE_FILE:-docker-compose.yml}"
env_file="${JALWA_ENV_FILE:-.env.staging}"

compose=(docker compose -f "$compose_file" --env-file "$env_file")

section() { printf '\n===== %s =====\n' "$1"; }

section "Compose services"
"${compose[@]}" ps || true

section "Web liveness from inside container"
"${compose[@]}" exec -T web sh -lc 'wget -S -O- http://127.0.0.1:3000/api/health 2>&1' || true

section "Web readiness from inside container"
"${compose[@]}" exec -T web sh -lc '
  if [ -n "${OPERATIONS_DIAGNOSTICS_SECRET:-}" ]; then
    wget -S -O- --header="x-jalwa-operations-token: ${OPERATIONS_DIAGNOSTICS_SECRET}" http://127.0.0.1:3000/api/readiness 2>&1
  else
    wget -S -O- http://127.0.0.1:3000/api/readiness 2>&1
  fi
' || true

section "PostgreSQL runtime checks"
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' || true
select current_database() as database, current_user as login_role, version();
select extname, extversion from pg_extension where extname in ('vector','pg_trgm') order by extname;
select rolname from pg_roles where rolname in ('anon','authenticated','service_role','authenticator') order by rolname;
select
  has_schema_privilege('anon','extensions','USAGE') as anon_extensions_usage,
  has_schema_privilege('authenticated','extensions','USAGE') as authenticated_extensions_usage,
  has_schema_privilege('service_role','extensions','USAGE') as service_role_extensions_usage;
set role anon;
select count(*) as active_categories from public.categories where is_active;
select count(*) as visible_catalogue_items from public.search_catalogue(null,null,40);
reset role;
SQL

section "Web logs (last 200 lines)"
"${compose[@]}" logs --no-color --tail=200 web 2>&1 || true

section "Worker logs (last 120 lines)"
"${compose[@]}" logs --no-color --tail=120 worker 2>&1 || true

section "PostgreSQL logs (last 120 lines)"
"${compose[@]}" logs --no-color --tail=120 postgres 2>&1 || true

section "Container health states"
for service in postgres web worker; do
  id="$("${compose[@]}" ps -q "$service" 2>/dev/null || true)"
  if [[ -n "$id" ]]; then
    docker inspect --format '{{.Name}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$id" || true
  fi
done
