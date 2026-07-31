#!/usr/bin/env bash
set -Eeuo pipefail

new_tag="${1:?new image tag is required}"
domain="${2:?production domain is required}"
root="${JALWA_ROOT:-/opt/jalwa}"
env_file="$root/.env.production"
last_good_file="$root/.last-good-image"

exec 9>"$root/.deploy.lock"
flock -n 9 || { echo "Another Jalwa deployment is running." >&2; exit 1; }

previous_tag=""
if [[ -s "$last_good_file" ]]; then previous_tag="$(tr -d '[:space:]' < "$last_good_file")"; fi
set_tag() {
  local tag="$1"
  if grep -q '^JALWA_IMAGE_TAG=' "$env_file"; then
    sed -i "s/^JALWA_IMAGE_TAG=.*/JALWA_IMAGE_TAG=${tag}/" "$env_file"
  else
    printf '\nJALWA_IMAGE_TAG=%s\n' "$tag" >> "$env_file"
  fi
}

rollback() {
  [[ -n "$previous_tag" && "$previous_tag" != "$new_tag" ]] || return 1
  echo "Release failed; restoring application image ${previous_tag}." >&2
  set_tag "$previous_tag"
  cd "$root"
  docker compose --env-file "$env_file" pull web worker
  docker compose --env-file "$env_file" up -d --remove-orphans web worker caddy
  "$root/scripts/smoke-test.sh" "https://${domain}" "https://api.${domain}"
  return 0
}

set_tag "$new_tag"
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
if ! "$root/scripts/smoke-test.sh" "https://${domain}" "https://api.${domain}"; then
  rollback || true
  exit 1
fi

printf '%s\n' "$new_tag" > "$last_good_file"
printf '%s %s\n' "$(date -u +%FT%TZ)" "$new_tag" > "$root/.last-successful-deploy"
echo "Jalwa release ${new_tag} is healthy."
