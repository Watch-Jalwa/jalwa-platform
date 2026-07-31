#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/jalwa}"
ENV_FILE="${APP_DIR}/.env.production"
SUPABASE_RUNTIME="${SUPABASE_RUNTIME:-${APP_DIR}/supabase/runtime}"
BACKUP_DIR="${BACKUP_DIR:-${APP_DIR}/backups/postgres}"
BASE_URL="${1:-${APP_URL:-https://watch-jalwa.com}}"
API_URL="${2:-https://api.watch-jalwa.com}"
MAX_DISK_PERCENT="${MAX_DISK_PERCENT:-85}"
MAX_BACKUP_AGE_SECONDS="${MAX_BACKUP_AGE_SECONDS:-108000}"
MAX_RESTORE_DRILL_AGE_SECONDS="${MAX_RESTORE_DRILL_AGE_SECONDS:-691200}"

fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS %s\n' "$*"; }
marker_age() {
  local marker="$1" timestamp epoch
  [[ -s "$marker" ]] || return 1
  timestamp="$(awk '{print $1}' "$marker")"
  epoch="$(date -u -d "$timestamp" +%s 2>/dev/null)" || return 1
  printf '%s\n' "$(( $(date -u +%s) - epoch ))"
}

[[ -s "$ENV_FILE" ]] || fail "Missing ${ENV_FILE}"
[[ -s "${SUPABASE_RUNTIME}/.env" ]] || fail "Missing self-hosted Supabase runtime"
set -a
source "$ENV_FILE"
set +a
cd "$APP_DIR"

[[ "${JALWA_IMAGE_TAG:-}" =~ ^[0-9a-f]{40}$ ]] || fail "JALWA_IMAGE_TAG is not a deployable Git commit SHA"
[[ "${GIT_SHA:-}" == "$JALWA_IMAGE_TAG" ]] || fail "GIT_SHA and JALWA_IMAGE_TAG differ before acceptance"
./scripts/smoke-test.sh "$BASE_URL" "$API_URL" "$JALWA_IMAGE_TAG"
docker compose --env-file "$ENV_FILE" config --quiet
pass "Compose and public smoke checks"

for service in web worker caddy; do
  id="$(docker compose --env-file "$ENV_FILE" ps -q "$service")"
  [[ -n "$id" ]] || fail "Missing app service: $service"
  [[ "$(docker inspect -f '{{.State.Running}}' "$id")" == "true" ]] || fail "Service not running: $service"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
  if [[ "$service" != "caddy" && "$health" != "healthy" ]]; then fail "Service unhealthy: $service ($health)"; fi
  pass "$service ($health)"
done

for container in supabase-db supabase-auth supabase-rest; do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" == "healthy" ]] || fail "Container not healthy: $container"
  pass "$container"
done

docker exec supabase-db pg_isready -U postgres -d postgres >/dev/null
migration_failures="$(docker exec supabase-db psql -U postgres -d postgres -Atqc "select count(*) from public.jalwa_schema_migrations where status is distinct from 'applied';")"
[[ "$migration_failures" == "0" ]] || fail "$migration_failures migration records are not applied"
pass "PostgreSQL and migration ledger"

stuck_jobs="$(docker exec supabase-db psql -U postgres -d postgres -Atqc "
select
  (select count(*) from public.media_jobs where (status='queued' and available_at < now()-interval '2 hours') or (status='processing' and locked_at < now()-interval '3 hours'))
 + (select count(*) from public.drm_packaging_jobs where (status='queued' and available_at < now()-interval '2 hours') or (status='processing' and locked_at < now()-interval '3 hours'))
 + (select count(*) from public.account_requests where status='processing' and locked_at < now()-interval '1 hour');")"
[[ "$stuck_jobs" == "0" ]] || fail "$stuck_jobs stuck jobs require review"
pass "Background queues"

for timer in jalwa-backup.timer jalwa-source-health.timer jalwa-account-requests.timer jalwa-maintenance.timer jalwa-restore-drill.timer; do
  systemctl is-enabled --quiet "$timer" || fail "$timer is not enabled"
  systemctl is-active --quiet "$timer" || fail "$timer is not active"
  pass "$timer"
done

backup_age="$(marker_age "$BACKUP_DIR/LAST_SUCCESS")" || fail "Backup freshness marker is missing or invalid"
(( backup_age <= MAX_BACKUP_AGE_SECONDS )) || fail "Latest backup is ${backup_age}s old"
restore_age="$(marker_age "$BACKUP_DIR/LAST_RESTORE_DRILL")" || fail "Restore-drill marker is missing or invalid"
(( restore_age <= MAX_RESTORE_DRILL_AGE_SECONDS )) || fail "Latest restore drill is ${restore_age}s old"
pass "Backup (${backup_age}s) and restore drill (${restore_age}s) freshness"

disk_percent="$(df -P "$APP_DIR" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
[[ "$disk_percent" =~ ^[0-9]+$ ]] || fail "Could not read disk utilization"
(( disk_percent < MAX_DISK_PERCENT )) || fail "Disk utilization is ${disk_percent}%"
pass "Disk utilization (${disk_percent}%)"

for setting in R2_BACKUP_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do [[ -n "${!setting:-}" ]] || fail "$setting is missing"; done
[[ "${PAYMENT_PROVIDER:-mock}" != "mock" ]] || fail "PAYMENT_PROVIDER cannot be mock in production"
if [[ "${NEXT_PUBLIC_ENABLE_PHONE_AUTH:-false}" == "true" ]]; then grep -q '^SMS_PROVIDER=.' "${APP_DIR}/.env.supabase" || fail "SMS provider is missing"; fi

headers="$(mktemp)"
trap 'rm -f "$headers"' EXIT
curl --fail --silent --show-error --head --max-time 20 "$BASE_URL/" > "$headers"
for expected in 'strict-transport-security:' 'x-content-type-options: nosniff' 'referrer-policy:' 'permissions-policy:' 'x-frame-options:' 'content-security-policy:' 'reporting-endpoints:' 'cross-origin-opener-policy:'; do
  grep -qi "^${expected}" "$headers" || fail "Security header missing: $expected"
done
pass "Security response headers and enforced content policy"

readiness="$(curl --fail --silent --show-error --max-time 20 "$BASE_URL/api/readiness")"
version="$(jq -r '.version // empty' <<<"$readiness")"
[[ "$version" == "$JALWA_IMAGE_TAG" ]] || fail "Readiness version ${version:-missing} does not match image tag $JALWA_IMAGE_TAG"
jq -e 'keys | sort == ["service","status","time","version"]' <<<"$readiness" >/dev/null || fail "Public readiness exposes internal diagnostics"

internal_status="$(curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/internal/readiness")"
[[ "$internal_status" == "401" ]] || fail "Internal readiness is accessible without authorization"

printf '{"status":"passed","host":"%s","imageTag":"%s","version":"%s","backupAgeSeconds":%s,"restoreAgeSeconds":%s,"diskPercent":%s,"checkedAt":"%s"}\n' \
  "$(hostname -f)" "$JALWA_IMAGE_TAG" "$version" "$backup_age" "$restore_age" "$disk_percent" "$(date -u +%FT%TZ)"
