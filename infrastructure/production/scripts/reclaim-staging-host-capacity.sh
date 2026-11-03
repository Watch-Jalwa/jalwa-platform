#!/usr/bin/env bash
# Safe Jalwa-scoped staging host capacity reclaim.
# Preserves PostgreSQL data volumes, running containers, and the current rollback release.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/codistan/jalwa-platform}"
PHASE="${1:-pre}"

echo "Filesystem before ${PHASE} capacity reclaim:"
df -hT /
docker system df || true

last_good=''
previous_good=''
[[ -s "$APP_DIR/.last-good-image" ]] && last_good="$(tr -d '[:space:]' < "$APP_DIR/.last-good-image")"
[[ -s "$APP_DIR/.previous-good-image" ]] && previous_good="$(tr -d '[:space:]' < "$APP_DIR/.previous-good-image")"

declare -A keep=()
while read -r ref; do
  [[ -n "$ref" ]] && keep["$ref"]=1
done < <(docker ps --format '{{.Image}}' | sort -u)

if [[ "$last_good" =~ ^[0-9a-f]{40}$ ]]; then
  keep["ghcr.io/watch-jalwa/jalwa-platform-web:$last_good"]=1
  keep["ghcr.io/watch-jalwa/jalwa-platform-worker:$last_good"]=1
fi

# Keep at most one additional rollback SHA when a container still references it.
if [[ "$previous_good" =~ ^[0-9a-f]{40}$ && "$previous_good" != "$last_good" ]]; then
  in_use=false
  for image in \
    "ghcr.io/watch-jalwa/jalwa-platform-web:$previous_good" \
    "ghcr.io/watch-jalwa/jalwa-platform-worker:$previous_good"; do
    if docker ps -a --format '{{.Image}}' | grep -Fxq "$image"; then
      in_use=true
      keep["$image"]=1
    fi
  done
  if [[ "$in_use" == false ]]; then
    docker image rm \
      "ghcr.io/watch-jalwa/jalwa-platform-web:$previous_good" \
      "ghcr.io/watch-jalwa/jalwa-platform-worker:$previous_good" >/dev/null 2>&1 || true
    rm -f "$APP_DIR/.previous-good-image"
    echo "Removed obsolete second Jalwa rollback release $previous_good; current rollback $last_good remains intact."
  else
    echo "Preserving previous Jalwa rollback $previous_good because a container still references it."
  fi
fi

removed=0
while read -r image; do
  [[ -n "$image" ]] || continue
  if [[ -z "${keep[$image]:-}" ]]; then
    if docker image rm "$image" >/dev/null 2>&1; then
      removed=$((removed + 1))
    fi
  fi
done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' \
  | grep -E '^ghcr\.io/watch-jalwa/jalwa-platform-(web|worker):[0-9a-f]{40}$' \
  | sort -u)

removed_containers=0
for service in web worker; do
  for status in created exited dead; do
    while read -r container; do
      [[ -n "$container" ]] || continue
      if docker rm "$container" >/dev/null 2>&1; then
        removed_containers=$((removed_containers + 1))
      fi
    done < <(docker ps -aq \
      --filter 'label=com.docker.compose.project=jalwa-platform' \
      --filter "label=com.docker.compose.service=$service" \
      --filter "status=$status")
  done
done

removed_volumes=0
while read -r volume; do
  [[ -n "$volume" ]] || continue
  case "$volume" in
    *postgres*|*database*|*_db*|*_data*|jalwa-platform_jalwa_staging_pgdata)
      echo "Preserving data-like dangling Jalwa volume: $volume"
      continue
      ;;
  esac
  if docker volume rm "$volume" >/dev/null 2>&1; then
    removed_volumes=$((removed_volumes + 1))
  fi
done < <({
  docker volume ls -q --filter dangling=true --filter 'label=com.docker.compose.project=jalwa-platform'
  docker volume ls -q --filter dangling=true | grep -E '^jalwa-platform_' || true
} | sort -u)

removed_anonymous_volumes=0
while read -r volume; do
  [[ -n "$volume" ]] || continue
  if docker volume rm "$volume" >/dev/null 2>&1; then
    removed_anonymous_volumes=$((removed_anonymous_volumes + 1))
  fi
done < <(docker volume ls -q --filter dangling=true | grep -E '^[0-9a-f]{64}$' || true)

if [[ -d "$APP_DIR/candidate-db" ]]; then
  find "$APP_DIR/candidate-db" -mindepth 1 -maxdepth 1 -type d -mtime +1 -print -exec rm -rf -- {} + || true
fi

if sudo -n true >/dev/null 2>&1; then
  sudo -n apt-get clean >/dev/null 2>&1 || true
  sudo -n rm -rf /var/lib/apt/lists/* >/dev/null 2>&1 || true
  sudo -n journalctl --vacuum-size=32M >/dev/null 2>&1 || true
  sudo -n logrotate -f /etc/logrotate.conf >/dev/null 2>&1 || true
  sudo -n find /var/log -xdev -type f \
    \( -name '*.gz' -o -name '*.old' -o -regex '.*/[^/]*\.[0-9]+' \) \
    -delete 2>/dev/null || true

  if command -v snap >/dev/null 2>&1; then
    while read -r snap_name snap_revision; do
      [[ -n "$snap_name" && "$snap_revision" =~ ^[0-9]+$ ]] || continue
      sudo -n snap remove "$snap_name" --revision="$snap_revision" >/dev/null 2>&1 || true
    done < <(snap list --all 2>/dev/null | awk 'NR>1 && $6 ~ /disabled/ {print $1, $3}')
  fi

  for container in jalwa-web-staging jalwa-worker-staging; do
    log_path="$(docker inspect --format '{{.LogPath}}' "$container" 2>/dev/null || true)"
    if [[ -n "$log_path" ]]; then
      log_bytes="$(sudo -n stat -c '%s' "$log_path" 2>/dev/null || echo 0)"
      if [[ "$log_bytes" =~ ^[0-9]+$ ]] && (( log_bytes > 67108864 )); then
        sudo -n truncate -s 0 "$log_path"
        echo "Rotated oversized log for $container."
      fi
    fi
  done
else
  echo 'Passwordless sudo unavailable; skipped OS cache/journal cleanup.'
fi

docker image prune -f >/dev/null
docker builder prune -af >/dev/null
# Do not docker logout here: candidate/main deploy authenticates to GHCR before
# reclaim and must still be able to pull the exact release after capacity work.

pre_policy_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ "$pre_policy_usage" =~ ^[0-9]+$ ]] && (( pre_policy_usage >= 85 )) && sudo -n true >/dev/null 2>&1; then
  root_source="$(findmnt -n -o SOURCE /)"
  root_fstype="$(findmnt -n -o FSTYPE /)"
  if [[ "$root_fstype" == ext4 && "$root_source" == /dev/* ]]; then
    block_count="$(sudo -n tune2fs -l "$root_source" 2>/dev/null | awk -F: '/^Block count:/ {gsub(/[[:space:]]/,"",$2); print $2; exit}')"
    reserved_blocks="$(sudo -n tune2fs -l "$root_source" 2>/dev/null | awk -F: '/^Reserved block count:/ {gsub(/[[:space:]]/,"",$2); print $2; exit}')"
    if [[ "$block_count" =~ ^[0-9]+$ && "$reserved_blocks" =~ ^[0-9]+$ ]] && (( block_count > 0 )); then
      reserved_pct="$(( (reserved_blocks * 100 + block_count - 1) / block_count ))"
      echo "Ext4 root reserve is approximately ${reserved_pct}% before capacity normalization."
      if (( reserved_pct > 2 )); then
        sudo -n tune2fs -m 2 "$root_source" >/dev/null
        echo "Reduced staging ext4 root reserve to 2%; no filesystem data was deleted."
      fi
    fi
  fi
fi

echo "Filesystem after ${PHASE} capacity reclaim:"
df -hT /
docker system df || true
usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
echo "Removed $removed stale Jalwa release image tags, $removed_containers stopped Jalwa app containers, $removed_volumes dangling non-data Jalwa volumes and $removed_anonymous_volumes anonymous volumes; root filesystem usage is ${usage}%."
[[ "$usage" =~ ^[0-9]+$ ]]

if (( usage >= 85 )); then
  echo "Staging disk remains above the acceptance threshold after ${PHASE} Jalwa-scoped cleanup; detailed Docker usage follows."
  docker system df -v || true
  lsblk -f || true
  findmnt / || true
  if sudo -n true >/dev/null 2>&1; then
    echo 'Largest top-level /var entries:'
    sudo -n du -xhd1 /var 2>/dev/null | sort -h | tail -n 20 || true
    echo 'Largest top-level /opt entries:'
    sudo -n du -xhd1 /opt 2>/dev/null | sort -h | tail -n 20 || true
  fi
fi

test "$usage" -lt 85
