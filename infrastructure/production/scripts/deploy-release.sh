#!/usr/bin/env bash
set -Eeuo pipefail

new_tag="${1:?new image tag is required}"
domain="${2:?production domain is required}"
root="${JALWA_ROOT:-/opt/jalwa}"
env_file="$root/.env.production"
last_good_file="$root/.last-good-image"
previous_good_file="$root/.previous-good-image"

[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]] || { echo "Image tag must be a 40-character lowercase Git commit SHA." >&2; exit 1; }
[[ -s "$env_file" ]] || { echo "Missing production environment: $env_file" >&2; exit 1; }

exec 9>"$root/.deploy.lock"
flock -n 9 || { echo "Another Jalwa deployment is running." >&2; exit 1; }

previous_tag=""
if [[ -s "$last_good_file" ]]; then
  previous_tag="$(tr -d '[:space:]' < "$last_good_file")"
  [[ "$previous_tag" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid last-good image marker." >&2; exit 1; }
fi

set_release() {
  local tag="$1"
  local temporary
  temporary="$(mktemp "${env_file}.XXXXXX")"

  if ! awk -v tag="$tag" '
    BEGIN { image = 0; git = 0 }
    /^JALWA_IMAGE_TAG=/ {
      if (!image) print "JALWA_IMAGE_TAG=" tag
      image = 1
      next
    }
    /^GIT_SHA=/ {
      if (!git) print "GIT_SHA=" tag
      git = 1
      next
    }
    { print }
    END {
      if (!image) print "JALWA_IMAGE_TAG=" tag
      if (!git) print "GIT_SHA=" tag
    }
  ' "$env_file" > "$temporary"; then
    rm -f "$temporary"
    return 1
  fi

  chmod 600 "$temporary"
  mv -f "$temporary" "$env_file"
}

write_marker() {
  local path="$1"
  local value="$2"
  local temporary="${path}.tmp.$$"
  printf '%s\n' "$value" > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$path"
}

rollback() {
  [[ -n "$previous_tag" && "$previous_tag" != "$new_tag" ]] || return 1
  echo "Release failed; restoring application image ${previous_tag}." >&2
  set_release "$previous_tag"
  cd "$root"
  docker compose --env-file "$env_file" config --quiet
  docker compose --env-file "$env_file" pull web worker
  docker compose --env-file "$env_file" up -d --remove-orphans web worker caddy
  "$root/scripts/smoke-test.sh" "https://${domain}" "https://api.${domain}" "$previous_tag"
  return 0
}

set_release "$new_tag"
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

if [[ -n "$previous_tag" && "$previous_tag" != "$new_tag" ]]; then
  write_marker "$previous_good_file" "$previous_tag"
fi
write_marker "$last_good_file" "$new_tag"
write_marker "$root/.last-successful-deploy" "$(date -u +%FT%TZ) $new_tag"
echo "Jalwa release ${new_tag} is healthy."
