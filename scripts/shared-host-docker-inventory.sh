#!/usr/bin/env bash
set -Eeuo pipefail

section() { printf '\n===== %s =====\n' "$1"; }

section "Root filesystem"
df -hT /
df -B1 /

section "Docker system summary"
docker system df || true

section "Containers with ownership labels"
docker ps -a --no-trunc --format '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}' | while IFS=$'\t' read -r id name image status; do
  project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$id" 2>/dev/null || true)"
  service="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$id" 2>/dev/null || true)"
  workdir="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$id" 2>/dev/null || true)"
  image_id="$(docker inspect -f '{{.Image}}' "$id" 2>/dev/null || true)"
  printf '%s\t%s\t%s\t%s\tproject=%s\tservice=%s\tworkdir=%s\timage_id=%s\n' "$id" "$name" "$image" "$status" "$project" "$service" "$workdir" "$image_id"
done

section "Image detailed storage accounting"
docker system df -v || true

section "Images not referenced by any container"
container_image_ids="$(docker ps -aq | xargs -r docker inspect -f '{{.Image}}' 2>/dev/null | sort -u)"
docker image ls --no-trunc --format '{{.ID}}\t{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}' | while IFS=$'\t' read -r id ref created size; do
  full_id="$id"
  short_id="${id#sha256:}"
  if ! grep -Fxq "sha256:$short_id" <<<"$container_image_ids" && ! grep -Fxq "$full_id" <<<"$container_image_ids"; then
    labels="$(docker image inspect -f '{{json .Config.Labels}}' "$id" 2>/dev/null || printf '{}')"
    printf '%s\t%s\t%s\t%s\tlabels=%s\n' "$id" "$ref" "$created" "$size" "$labels"
  fi
done

section "Dangling images"
docker image ls -f dangling=true --no-trunc --format '{{.ID}}\t{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}' || true

section "Volumes and container references"
for volume in $(docker volume ls -q); do
  refs="$(docker ps -a --filter volume="$volume" --format '{{.Names}}' | paste -sd, -)"
  labels="$(docker volume inspect -f '{{json .Labels}}' "$volume" 2>/dev/null || printf '{}')"
  mountpoint="$(docker volume inspect -f '{{.Mountpoint}}' "$volume" 2>/dev/null || true)"
  bytes='unknown'
  if [[ -n "$mountpoint" ]] && sudo -n true >/dev/null 2>&1; then
    bytes="$(sudo -n du -sb "$mountpoint" 2>/dev/null | awk '{print $1}' || true)"
    [[ -n "$bytes" ]] || bytes='unknown'
  fi
  printf '%s\trefs=%s\tbytes=%s\tlabels=%s\n' "$volume" "${refs:-NONE}" "$bytes" "$labels"
done

section "Unused volumes only"
for volume in $(docker volume ls -q); do
  if [[ -z "$(docker ps -a --filter volume="$volume" -q)" ]]; then
    labels="$(docker volume inspect -f '{{json .Labels}}' "$volume" 2>/dev/null || printf '{}')"
    mountpoint="$(docker volume inspect -f '{{.Mountpoint}}' "$volume" 2>/dev/null || true)"
    bytes='unknown'
    if [[ -n "$mountpoint" ]] && sudo -n true >/dev/null 2>&1; then
      bytes="$(sudo -n du -sb "$mountpoint" 2>/dev/null | awk '{print $1}' || true)"
      [[ -n "$bytes" ]] || bytes='unknown'
    fi
    printf '%s\tbytes=%s\tlabels=%s\n' "$volume" "$bytes" "$labels"
  fi
done

section "Jalwa release safety check"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep '^jalwa-' || true
docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}' | grep '^ghcr.io/watch-jalwa/jalwa-platform-' || true
