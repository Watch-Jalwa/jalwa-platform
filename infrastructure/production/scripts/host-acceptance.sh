#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/jalwa}"
ENV_FILE="${APP_DIR}/.env.production"
SUPABASE_RUNTIME="${SUPABASE_RUNTIME:-${APP_DIR}/supabase/runtime}"

[[ -s "$ENV_FILE" ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }
[[ -s "${SUPABASE_RUNTIME}/.env" ]] || { echo "Missing self-hosted Supabase runtime" >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

cd "$APP_DIR"
for service in web worker caddy; do
  id="$(docker compose --env-file "$ENV_FILE" ps -q "$service")"
  [[ -n "$id" ]] || { echo "Missing app service: $service" >&2; exit 1; }
  [[ "$(docker inspect -f '{{.State.Running}}' "$id")" == "true" ]] || { echo "Service not running: $service" >&2; exit 1; }
done

for container in supabase-db supabase-auth supabase-rest; do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" == "healthy" ]] || { echo "Container not healthy: $container" >&2; exit 1; }
done

docker exec supabase-db pg_isready -U postgres -d postgres >/dev/null
docker exec supabase-db psql -U postgres -d postgres -Atqc "select count(*) from public.jalwa_schema_migrations" | grep -Eq '^[1-9][0-9]*$'
systemctl is-enabled --quiet jalwa-backup.timer
systemctl is-active --quiet jalwa-backup.timer
test -n "${R2_BACKUP_BUCKET:-}"
test -n "${R2_ACCESS_KEY_ID:-}"
test -n "${R2_SECRET_ACCESS_KEY:-}"

if [[ "${PAYMENT_PROVIDER:-mock}" == "mock" ]]; then echo "PAYMENT_PROVIDER cannot be mock in production" >&2; exit 1; fi
if [[ "${NEXT_PUBLIC_ENABLE_PHONE_AUTH:-false}" == "true" ]]; then grep -q '^SMS_PROVIDER=.' "${APP_DIR}/.env.supabase"; fi

printf '{"status":"passed","host":"%s","imageTag":"%s","checkedAt":"%s"}\n' "$(hostname -f)" "${JALWA_IMAGE_TAG:-unknown}" "$(date -u +%FT%TZ)"
