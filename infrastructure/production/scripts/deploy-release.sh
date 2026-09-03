#!/usr/bin/env bash
set -Eeuo pipefail

new_tag="${1:?new image tag is required}"
domain="${2:?deployment domain is required}"
new_web_image="${3:-ghcr.io/watch-jalwa/jalwa-platform-web:${new_tag}}"
new_worker_image="${4:-ghcr.io/watch-jalwa/jalwa-platform-worker:${new_tag}}"
root="${JALWA_ROOT:-/opt/jalwa}"
env_file="${JALWA_ENV_FILE:-$root/.env.production}"
compose_file="${JALWA_COMPOSE_FILE:-$root/docker-compose.yml}"
smoke_base_url="${JALWA_SMOKE_BASE_URL:-https://${domain}}"
last_good_file="$root/.last-good-image"
previous_good_file="$root/.previous-good-image"
manifest_dir="$root/deployments"
read -r -a deployment_services <<< "${JALWA_COMPOSE_SERVICES:-}"
read -r -a health_services <<< "${JALWA_HEALTH_SERVICES:-web worker}"
preserve_dependencies="${JALWA_DEPLOY_NO_DEPS:-false}"
health_wait_timeout="${JALWA_HEALTH_WAIT_TIMEOUT_SECONDS:-180}"
health_wait_interval="${JALWA_HEALTH_WAIT_INTERVAL_SECONDS:-2}"
export COMPOSE_FILE="$compose_file"

[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]] || { echo "Image tag must be a 40-character lowercase Git commit SHA." >&2; exit 1; }
[[ -s "$env_file" ]] || { echo "Missing deployment environment: $env_file" >&2; exit 1; }
[[ -s "${compose_file%%:*}" ]] || { echo "Missing deployment compose file: ${compose_file%%:*}" >&2; exit 1; }
[[ "$preserve_dependencies" == "true" || "$preserve_dependencies" == "false" ]] || { echo "JALWA_DEPLOY_NO_DEPS must be true or false." >&2; exit 1; }
[[ "$smoke_base_url" =~ ^https?:// ]] || { echo "JALWA_SMOKE_BASE_URL must be an http(s) URL." >&2; exit 1; }
[[ "$health_wait_timeout" =~ ^[1-9][0-9]*$ ]] || { echo "JALWA_HEALTH_WAIT_TIMEOUT_SECONDS must be a positive integer." >&2; exit 1; }
[[ "$health_wait_interval" =~ ^[0-9]+$ ]] || { echo "JALWA_HEALTH_WAIT_INTERVAL_SECONDS must be a non-negative integer." >&2; exit 1; }
((${#health_services[@]})) || { echo "At least one JALWA_HEALTH_SERVICES service is required." >&2; exit 1; }

compose() {
  docker compose --env-file "$env_file" "$@"
}

validate_image_ref() {
  local service="$1" ref="$2"
  [[ "$ref" =~ ^ghcr\.io/watch-jalwa/jalwa-platform-${service}(:[0-9a-f]{40}|@sha256:[0-9a-f]{64})$ ]] \
    || { echo "Invalid immutable image reference for $service." >&2; return 1; }
}
validate_image_ref web "$new_web_image"
validate_image_ref worker "$new_worker_image"

exec 9>"$root/.deploy.lock"
flock -n 9 || { echo "Another Jalwa deployment is running." >&2; exit 1; }
mkdir -p "$manifest_dir"

previous_tag=""
previous_web_image=""
previous_worker_image=""
if [[ -s "$last_good_file" ]]; then
  previous_tag="$(tr -d '[:space:]' < "$last_good_file")"
  [[ "$previous_tag" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid last-good image marker." >&2; exit 1; }
  previous_manifest="$manifest_dir/${previous_tag}.images.env"
  if [[ -s "$previous_manifest" ]]; then
    previous_web_image="$(grep -m1 '^JALWA_WEB_IMAGE=' "$previous_manifest" | cut -d= -f2-)"
    previous_worker_image="$(grep -m1 '^JALWA_WORKER_IMAGE=' "$previous_manifest" | cut -d= -f2-)"
  else
    previous_web_image="ghcr.io/watch-jalwa/jalwa-platform-web:${previous_tag}"
    previous_worker_image="ghcr.io/watch-jalwa/jalwa-platform-worker:${previous_tag}"
  fi
  validate_image_ref web "$previous_web_image"
  validate_image_ref worker "$previous_worker_image"
fi

set_release() {
  local tag="$1" web_image="$2" worker_image="$3" temporary
  temporary="$(mktemp "${env_file}.XXXXXX")"

  if ! awk -v tag="$tag" -v web="$web_image" -v worker="$worker_image" '
    BEGIN { image = 0; git = 0; web_seen = 0; worker_seen = 0 }
    /^JALWA_IMAGE_TAG=/ { if (!image) print "JALWA_IMAGE_TAG=" tag; image = 1; next }
    /^GIT_SHA=/ { if (!git) print "GIT_SHA=" tag; git = 1; next }
    /^JALWA_WEB_IMAGE=/ { if (!web_seen) print "JALWA_WEB_IMAGE=" web; web_seen = 1; next }
    /^JALWA_WORKER_IMAGE=/ { if (!worker_seen) print "JALWA_WORKER_IMAGE=" worker; worker_seen = 1; next }
    { print }
    END {
      if (!image) print "JALWA_IMAGE_TAG=" tag
      if (!git) print "GIT_SHA=" tag
      if (!web_seen) print "JALWA_WEB_IMAGE=" web
      if (!worker_seen) print "JALWA_WORKER_IMAGE=" worker
    }
  ' "$env_file" > "$temporary"; then
    rm -f "$temporary"
    return 1
  fi

  chmod 600 "$temporary"
  mv -f "$temporary" "$env_file"
}

write_marker() {
  local path="$1" value="$2" temporary
  temporary="${path}.tmp.$$"
  printf '%s\n' "$value" > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$path"
}

write_manifest() {
  local tag="$1" web_image="$2" worker_image="$3" path temporary
  path="$manifest_dir/${tag}.images.env"
  temporary="${path}.tmp.$$"
  {
    printf 'JALWA_IMAGE_TAG=%s\n' "$tag"
    printf 'GIT_SHA=%s\n' "$tag"
    printf 'JALWA_WEB_IMAGE=%s\n' "$web_image"
    printf 'JALWA_WORKER_IMAGE=%s\n' "$worker_image"
  } > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$path"
}

pull_selected() {
  if ((${#deployment_services[@]})); then compose pull "${deployment_services[@]}"; else compose pull; fi
}

up_selected() {
  local args=(up -d --remove-orphans)
  if [[ "$preserve_dependencies" == "true" ]]; then args+=(--no-deps); fi
  if ((${#deployment_services[@]})); then compose "${args[@]}" "${deployment_services[@]}"; else compose "${args[@]}"; fi
}

wait_for_service_health() {
  local deadline=$((SECONDS + health_wait_timeout))
  local service id state health all_ready

  while :; do
    all_ready=true
    for service in "${health_services[@]}"; do
      id="$(compose ps -q "$service" 2>/dev/null || true)"
      if [[ -z "$id" ]]; then
        all_ready=false
        continue
      fi
      state="$(docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null || true)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || true)"
      case "$state" in
        exited|dead)
          echo "Release service ${service} entered terminal state ${state} before smoke testing." >&2
          docker logs --tail 100 "$id" >&2 2>/dev/null || true
          return 1
          ;;
      esac
      if [[ "$state" != "running" || "$health" != "healthy" ]]; then
        all_ready=false
      fi
    done

    if [[ "$all_ready" == "true" ]]; then
      echo "Release services are healthy: ${health_services[*]}"
      return 0
    fi
    if ((SECONDS >= deadline)); then
      echo "Timed out after ${health_wait_timeout}s waiting for release service health: ${health_services[*]}" >&2
      compose ps >&2 || true
      for service in "${health_services[@]}"; do
        id="$(compose ps -q "$service" 2>/dev/null || true)"
        [[ -n "$id" ]] && docker inspect -f '{{.Name}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" >&2 2>/dev/null || true
      done
      return 1
    fi
    sleep "$health_wait_interval"
  done
}

rollback() {
  [[ -n "$previous_tag" && "$previous_tag" != "$new_tag" ]] || return 1
  echo "Release failed; restoring application release ${previous_tag}." >&2
  set_release "$previous_tag" "$previous_web_image" "$previous_worker_image"
  cd "$root"
  compose config --quiet
  compose pull web worker
  local args=(up -d --remove-orphans)
  if [[ "$preserve_dependencies" == "true" ]]; then args+=(--no-deps); fi
  if ((${#deployment_services[@]})); then
    compose "${args[@]}" "${deployment_services[@]}"
  else
    compose "${args[@]}" web worker caddy
  fi
  wait_for_service_health
  "$root/scripts/smoke-test.sh" "$smoke_base_url" "" "$previous_tag"
  return 0
}

set_release "$new_tag" "$new_web_image" "$new_worker_image"
cd "$root"
compose config --quiet
if ! pull_selected; then
  rollback || true
  exit 1
fi
if ! up_selected; then
  rollback || true
  exit 1
fi
if ! wait_for_service_health; then
  rollback || true
  exit 1
fi
if ! "$root/scripts/smoke-test.sh" "$smoke_base_url" "" "$new_tag"; then
  rollback || true
  exit 1
fi

write_manifest "$new_tag" "$new_web_image" "$new_worker_image"
if [[ -n "$previous_tag" && "$previous_tag" != "$new_tag" ]]; then
  write_marker "$previous_good_file" "$previous_tag"
fi
write_marker "$last_good_file" "$new_tag"
write_marker "$root/.last-successful-deploy" "$(date -u +%FT%TZ) $new_tag"
echo "Jalwa release ${new_tag} is healthy."
