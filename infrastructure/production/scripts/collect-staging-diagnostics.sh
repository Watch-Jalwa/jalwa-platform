#!/usr/bin/env bash
set -Eeuo pipefail

compose_file="${COMPOSE_FILE:-docker-compose.yml}"
env_file="${JALWA_ENV_FILE:-.env.staging}"
export COMPOSE_FILE="$compose_file"

compose=(docker compose --env-file "$env_file")

section() { printf '\n===== %s =====\n' "$1"; }

section "Host capacity (read-only)"
df -hT / || true
docker system df || true
usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
echo "Root filesystem usage: ${usage}%"

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

section "Published media resolutions (read-only)"
db_name="$("${compose[@]}" exec -T postgres sh -lc 'printf %s "${POSTGRES_DB:-postgres}"')"
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db_name" <<'SQL' || true
select ci.slug,
       ma.width,
       ma.height,
       least(coalesce(ma.width, 0), coalesce(ma.height, 0)) as min_edge,
       ma.storage_path
from public.content_items ci
join public.media_assets ma on ma.content_id = ci.id
where ci.status = 'published'
  and ma.status = 'ready'
order by min_edge asc, ci.slug;
SQL

section "Approved live-source delivery split (read-only)"
"${compose[@]}" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db_name" <<'SQL' || true
select
  l.delivery_adapter,
  l.expected_media_type,
  c.hosting_mode,
  count(*) as source_count
from public.live_source_configs l
join public.playback_sources p on p.id = l.playback_source_id
join public.content_items c on c.id = p.content_id
join public.approved_live_catalogue_manifest m on m.source_key = l.source_key
group by 1, 2, 3
order by 1, 2, 3;

select
  count(*) filter (
    where l.delivery_adapter='public_domain_live_image'
      and l.expected_media_type='current_image'
      and c.hosting_mode='self_host_open'
  ) as current_images,
  count(*) filter (
    where l.delivery_adapter='official_live_link'
      and l.expected_media_type='official_link'
      and c.hosting_mode='external_link'
  ) as official_links,
  count(*) filter (
    where l.delivery_adapter='official_live_embed'
  ) as official_embeds,
  count(*) as total_manifest_sources
from public.live_source_configs l
join public.playback_sources p on p.id = l.playback_source_id
join public.content_items c on c.id = p.content_id
join public.approved_live_catalogue_manifest m on m.source_key = l.source_key;

select exists(
  select 1
  from public.jalwa_schema_migrations
  where filename = '202609290001_live_catalogue_upstream_refresh.sql'
    and status = 'applied'
) as launch_refresh_migration_applied;
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
