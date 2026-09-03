#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/jalwa}"
DB_CONTAINER="${DB_CONTAINER:-jalwa-postgres}"
if [[ -n "${JALWA_ENV_FILE:-}" ]]; then
  ENV_FILE="$JALWA_ENV_FILE"
elif [[ -s "${APP_DIR}/.env.production" ]]; then
  ENV_FILE="${APP_DIR}/.env.production"
elif [[ -s "${APP_DIR}/.env.staging" ]]; then
  ENV_FILE="${APP_DIR}/.env.staging"
else
  ENV_FILE="${APP_DIR}/.env.production"
fi

if [[ -n "${JALWA_COMPOSE_FILE:-}" ]]; then
  COMPOSE_FILE_VALUE="$JALWA_COMPOSE_FILE"
elif [[ "$ENV_FILE" == *.env.staging && -s "${APP_DIR}/docker-compose.onprem.yml" ]]; then
  COMPOSE_FILE_VALUE="${APP_DIR}/docker-compose.yml:${APP_DIR}/docker-compose.onprem.yml"
else
  COMPOSE_FILE_VALUE="${APP_DIR}/docker-compose.yml"
fi

BACKUP_DIR="${BACKUP_DIR:-${APP_DIR}/backups/postgres}"
BASE_URL="${1:-${APP_URL:-https://watch-jalwa.com}}"
API_URL="${2:-}" # positional compatibility only; no separate data/auth gateway exists.
MAX_DISK_PERCENT="${MAX_DISK_PERCENT:-85}"
MAX_BACKUP_AGE_SECONDS="${MAX_BACKUP_AGE_SECONDS:-108000}"
MAX_RESTORE_DRILL_AGE_SECONDS="${MAX_RESTORE_DRILL_AGE_SECONDS:-691200}"
SKIP_EDGE_CHECKS="${JALWA_SKIP_EDGE_CHECKS:-false}"
if [[ -n "${JALWA_EXPECT_SERVICES:-}" ]]; then
  read -r -a expected_services <<< "$JALWA_EXPECT_SERVICES"
elif [[ "$ENV_FILE" == *.env.staging ]]; then
  expected_services=(postgres web worker)
else
  expected_services=(postgres web worker caddy)
fi
export COMPOSE_FILE="$COMPOSE_FILE_VALUE"

fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS %s\n' "$*"; }
marker_age() {
  local marker="$1" timestamp epoch
  [[ -s "$marker" ]] || return 1
  timestamp="$(awk '{print $1}' "$marker")"
  epoch="$(date -u -d "$timestamp" +%s 2>/dev/null)" || return 1
  printf '%s\n' "$(( $(date -u +%s) - epoch ))"
}

[[ "$SKIP_EDGE_CHECKS" == "true" || "$SKIP_EDGE_CHECKS" == "false" ]] || fail "JALWA_SKIP_EDGE_CHECKS must be true or false"
[[ -s "$ENV_FILE" ]] || fail "Missing ${ENV_FILE}"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
cd "$APP_DIR"

[[ "${JALWA_IMAGE_TAG:-}" =~ ^[0-9a-f]{40}$ ]] || fail "JALWA_IMAGE_TAG is not a deployable Git commit SHA"
[[ "${GIT_SHA:-}" == "$JALWA_IMAGE_TAG" ]] || fail "GIT_SHA and JALWA_IMAGE_TAG differ before acceptance"
./scripts/smoke-test.sh "$BASE_URL" "$API_URL" "$JALWA_IMAGE_TAG"
docker compose --env-file "$ENV_FILE" config --quiet
pass "Compose and application smoke checks"

for service in "${expected_services[@]}"; do
  id="$(docker compose --env-file "$ENV_FILE" ps -q "$service")"
  [[ -n "$id" ]] || fail "Missing app service: $service"
  [[ "$(docker inspect -f '{{.State.Running}}' "$id")" == "true" ]] || fail "Service not running: $service"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
  if [[ "$service" == "postgres" && "$health" == "none" ]]; then
    docker exec "$DB_CONTAINER" pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" >/dev/null \
      || fail "Service unhealthy: postgres (no Docker healthcheck and pg_isready failed)"
  elif [[ "$service" != "caddy" && "$health" != "healthy" ]]; then
    fail "Service unhealthy: $service ($health)"
  fi
  pass "$service ($health)"
done

docker exec "$DB_CONTAINER" pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" >/dev/null
migration_failures="$(docker exec "$DB_CONTAINER" psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -Atqc "select count(*) from public.jalwa_schema_migrations where status is distinct from 'applied';")"
[[ "$migration_failures" == "0" ]] || fail "$migration_failures migration records are not applied"
pass "PostgreSQL and migration ledger"

stuck_jobs="$(docker exec "$DB_CONTAINER" psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -Atqc "
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

for setting in R2_BACKUP_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BETTER_AUTH_SECRET SMTP_HOST; do [[ -n "${!setting:-}" ]] || fail "$setting is missing"; done
if [[ "${PAYMENT_PROVIDER:-mock}" == "mock" ]]; then
  [[ "${DEPLOYMENT_ENVIRONMENT:-production}" == "staging" && "${ALLOW_MOCK_PAYMENTS:-false}" == "true" ]] \
    || fail "Mock payments are allowed only in an explicit staging deployment"
  pass "Staging mock payment isolation"
else
  [[ "${PAYMENT_PROVIDER}" =~ ^(payfast|jazzcash|easypaisa)$ ]] || fail "Unsupported payment provider"
fi
if [[ "${NEXT_PUBLIC_ENABLE_PHONE_AUTH:-false}" == "true" ]]; then fail "Phone authentication is not enabled in the Better Auth deployment contract"; fi

if [[ "$SKIP_EDGE_CHECKS" == "false" ]]; then
  headers="$(mktemp)"
  trap 'rm -f "$headers"' EXIT
  curl --fail --silent --show-error --head --max-time 20 "$BASE_URL/" > "$headers"
  for expected in 'strict-transport-security:' 'x-content-type-options: nosniff' 'referrer-policy:' 'permissions-policy:' 'x-frame-options:'; do
    grep -qi "^${expected}" "$headers" || fail "Security header missing: $expected"
  done
  pass "Security response headers"
else
  pass "Edge-only checks delegated to external certification runner"
fi

version="$(curl --fail --silent --show-error --max-time 20 "$BASE_URL/api/readiness" | jq -r '.version // empty')"
[[ "$version" == "$JALWA_IMAGE_TAG" ]] || fail "Readiness version ${version:-missing} does not match image tag $JALWA_IMAGE_TAG"

printf '{"status":"passed","environment":"%s","host":"%s","imageTag":"%s","version":"%s","backupAgeSeconds":%s,"restoreAgeSeconds":%s,"diskPercent":%s,"checkedAt":"%s"}\n' \
  "${DEPLOYMENT_ENVIRONMENT:-production}" "$(hostname -f)" "$JALWA_IMAGE_TAG" "$version" "$backup_age" "$restore_age" "$disk_percent" "$(date -u +%FT%TZ)"
