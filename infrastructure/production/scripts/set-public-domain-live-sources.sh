#!/usr/bin/env bash
set -Eeuo pipefail

desired_state="${1:?desired state true or false is required}"
expected_sha="${2:?expected release SHA is required}"
domain="${3:?deployment domain is required}"
deployment_environment="${4:?deployment environment is required}"
root="${JALWA_ROOT:-/opt/jalwa}"
env_file="$root/.env.production"
marker_file="$root/.public-domain-live-sources"

case "$desired_state" in
  true|false) ;;
  *) echo "Desired state must be true or false." >&2; exit 1 ;;
esac
case "$deployment_environment" in
  staging|production) ;;
  *) echo "Deployment environment must be staging or production." >&2; exit 1 ;;
esac
[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected release must be a 40-character lowercase Git SHA." >&2; exit 1; }
[[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Domain contains unsupported characters." >&2; exit 1; }
[[ -s "$env_file" ]] || { echo "Missing runtime environment: $env_file" >&2; exit 1; }

exec 9>"$root/.deploy.lock"
flock -n 9 || { echo "Another Jalwa deployment or activation is running." >&2; exit 1; }

read_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$env_file"
}

current_sha="$(read_env_value GIT_SHA)"
[[ "$current_sha" == "$expected_sha" ]] || {
  echo "Refusing activation: deployed SHA ${current_sha:-missing} does not match expected SHA $expected_sha." >&2
  exit 1
}

current_environment="$(read_env_value DEPLOYMENT_ENVIRONMENT)"
[[ "$current_environment" == "$deployment_environment" ]] || {
  echo "Refusing activation: host environment ${current_environment:-missing} does not match $deployment_environment." >&2
  exit 1
}

previous_state="$(read_env_value PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED)"
case "$previous_state" in
  true|false) ;;
  "") previous_state=false ;;
  *) echo "Existing PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED value is invalid." >&2; exit 1 ;;
esac

set_flag() {
  local value="$1"
  local temporary
  temporary="$(mktemp "${env_file}.XXXXXX")"

  if ! awk -v value="$value" '
    BEGIN { written = 0 }
    /^PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=/ {
      if (!written) print "PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=" value
      written = 1
      next
    }
    { print }
    END {
      if (!written) print "PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=" value
    }
  ' "$env_file" > "$temporary"; then
    rm -f "$temporary"
    return 1
  fi

  chmod 600 "$temporary"
  mv -f "$temporary" "$env_file"
}

restart_application() {
  cd "$root"
  docker compose --env-file "$env_file" config --quiet
  docker compose --env-file "$env_file" up -d --remove-orphans --force-recreate web worker caddy
  "$root/scripts/smoke-test.sh" "https://${domain}" "https://api.${domain}" "$expected_sha"
}

rollback() {
  echo "Activation failed; restoring PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=$previous_state." >&2
  set_flag "$previous_state" || return 1
  restart_application || return 1
}

set_flag "$desired_state"
if ! restart_application; then
  rollback || true
  exit 1
fi

if [[ "$desired_state" == true ]]; then
  cron_secret="$(read_env_value CRON_SECRET)"
  [[ -n "$cron_secret" ]] || {
    rollback || true
    echo "CRON_SECRET is required for the provider-aware source-health check." >&2
    exit 1
  }
  if ! DOMAIN="$domain" CRON_SECRET="$cron_secret" "$root/scripts/run-source-health.sh"; then
    rollback || true
    echo "Source-health verification failed; activation was rolled back." >&2
    exit 1
  fi
fi

temporary_marker="${marker_file}.tmp.$$"
printf '%s\n' \
  "updated_at=$(date -u +%FT%TZ)" \
  "environment=$deployment_environment" \
  "release_sha=$expected_sha" \
  "enabled=$desired_state" > "$temporary_marker"
chmod 600 "$temporary_marker"
mv -f "$temporary_marker" "$marker_file"

echo "Public-domain live sources set to $desired_state for $deployment_environment release $expected_sha."