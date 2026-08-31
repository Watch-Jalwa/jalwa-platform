#!/usr/bin/env bash
set -Eeuo pipefail

new_tag="${1:?new image tag is required}"
domain="${2:?production domain is required}"
new_web_image="${3:-ghcr.io/watch-jalwa/jalwa-platform-web:${new_tag}}"
new_worker_image="${4:-ghcr.io/watch-jalwa/jalwa-platform-worker:${new_tag}}"
root="${JALWA_ROOT:-/opt/jalwa}"
env_file="$root/.env.production"
last_good_file="$root/.last-good-image"
previous_good_file="$root/.previous-good-image"
manifest_dir="$root/deployments"

[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]] || { echo "Image tag must be a 40-character lowercase Git commit SHA." >&2; exit 1; }
[[ -s "$env_file" ]] || { echo "Missing production environment: $env_file" >&2; exit 1; }

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
  local path="$1" value="$2" temporary="${path}.tmp.$$"
  printf '%s\n' "$value" > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$path"
}

write_manifest() {
  local tag="$1" web_image="$2" worker_image="$3" path="$manifest_dir/${tag}.images.env" temporary="${path}.tmp.$$"
  {
    printf 'JALWA_IMAGE_TAG=%s\n' "$tag"
    printf 'GIT_SHA=%s\n' "$tag"
    printf 'JALWA_WEB_IMAGE=%s\n' "$web_image"
    printf 'JALWA_WORKER_IMAGE=%s\n' "$worker_image"
  } > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$path"
}

rollback() {
  [[ -n "$previous_tag" && "$previous_tag" != "$new_tag" ]] || return 1
  echo "Release failed; restoring application release ${previous_tag}." >&2
  set_release "$previous_tag" "$previous_web_image" "$previous_worker_image"
  cd "$root"
  docker compose --env-file "$env_file" config --quiet
  docker compose --env-file "$env_file" pull web worker
  docker compose --env-file "$env_file" up -d --remove-orphans web worker caddy
  "$root/scripts/smoke-test.sh" "https://${domain}" "https://api.${domain}" "$previous_tag"
  return 0
}

set_release "$new_tag" "$new_web_image" "$new_worker_image"
cd "$root"
docker compose --env-file "$env_file" config --quiet
if ! docker compose --env-file "$env_file" pull; then
  rollback || true
  exit 1
fi
if ! docker compose --env-file "$env_file" up -d --remove-orphans; then
  rollback || true
  exit 1
fi
if ! "$root/scripts/smoke-test.sh" "https://${domain}" "https://api.${domain}" "$new_tag"; then
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
