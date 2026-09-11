#!/usr/bin/env bash
set -Eeuo pipefail

ACTIVE_RANCHERS='sha256:4b83f9fe0534f315925d076e959bc44c44506f4bb3c76f194b4295ada6b27fc4'
ROLLBACK_RANCHERS='sha256:4001da4f50355877ef922cf7ba637bfe0450f1f219c9cce64121531ec982b93e'
JALWA_WEB='sha256:d32211a573a388a7155c80e946f39404e131d90b530283891592c43b13ddac74'
JALWA_WORKER='sha256:263da7666c3f8a76e0f5cc179bd4169e66935db671efa6b797fb2e993e229bbc'

targets=(
  'sha256:7405a1719dbe8ca1b4bf4d70893face79a94f778cf0aae0aec2f044306af4756'
  'sha256:8a9f91e4e64642da3bb7bc74c45bcabb9f1fb9b65db8919c5dfc55a549dc1e35'
  'sha256:dbee4dbcfbbff0c33fa045c0c0df6826f05a91213cfa61f1a86bcc2d61368802'
  'sha256:b3243fc0188a2db100a3cb74828bd55848cf74ee7e2c038df9c34a14f13a915d'
  'sha256:807a3010f29c96b4cc60fa2e831eb582d9c791bd4e845aeff48f0b1940bc24bd'
)

section() { printf '\n===== %s =====\n' "$1"; }
image_exists() { docker image inspect "$1" >/dev/null 2>&1; }
container_refs_image() {
  local wanted="$1" id image
  while read -r id; do
    [[ -n "$id" ]] || continue
    image="$(docker inspect -f '{{.Image}}' "$id")"
    if [[ "$image" == "$wanted" ]]; then return 0; fi
  done < <(docker ps -aq)
  return 1
}

section 'Preflight filesystem and retained releases'
df -hT /
for keep in "$ACTIVE_RANCHERS" "$ROLLBACK_RANCHERS" "$JALWA_WEB" "$JALWA_WORKER"; do
  image_exists "$keep" || { echo "Required retained image missing: $keep" >&2; exit 1; }
done

docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E '^(ranchers-web-stabilization|ranchers-web-stabilization-rollback|jalwa-web-staging|jalwa-worker-staging|jalwa-postgres-staging)\b' || true

section 'Validate exact stale image targets'
for image in "${targets[@]}"; do
  if ! image_exists "$image"; then
    echo "Target already absent: $image"
    continue
  fi
  source_label="$(docker image inspect -f '{{ index .Config.Labels "org.opencontainers.image.source" }}' "$image" 2>/dev/null || true)"
  case "$source_label" in
    https://github.com/RanchersCafe/web-app|git@github.com:RanchersCafe/web-app.git) ;;
    *) echo "Refusing unexpected image source for $image: $source_label" >&2; exit 1 ;;
  esac
  if container_refs_image "$image"; then
    echo "Refusing to remove container-referenced image: $image" >&2
    exit 1
  fi
  docker image inspect -f 'target={{.Id}} tags={{json .RepoTags}} created={{.Created}} source={{ index .Config.Labels "org.opencontainers.image.source" }} revision={{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image"
done

section 'Remove only validated stale Ranchers images'
for image in "${targets[@]}"; do
  if image_exists "$image"; then
    docker image rm "$image"
  fi
done

section 'Post-cleanup retained image assertions'
for keep in "$ACTIVE_RANCHERS" "$ROLLBACK_RANCHERS" "$JALWA_WEB" "$JALWA_WORKER"; do
  image_exists "$keep" || { echo "Retained image disappeared: $keep" >&2; exit 1; }
done
for image in "${targets[@]}"; do
  if image_exists "$image"; then
    echo "Stale image still exists after removal: $image" >&2
    exit 1
  fi
done

section 'Post-cleanup service safety'
test "$(docker inspect -f '{{.State.Running}}' ranchers-web-stabilization)" = true
test "$(docker inspect -f '{{.State.Running}}' jalwa-web-staging)" = true
test "$(docker inspect -f '{{.State.Running}}' jalwa-worker-staging)" = true
test "$(docker inspect -f '{{.State.Running}}' jalwa-postgres-staging)" = true
for c in jalwa-web-staging jalwa-worker-staging; do
  test "$(docker inspect -f '{{.State.Health.Status}}' "$c")" = healthy
done

docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E '^(ranchers-web-stabilization|ranchers-web-stabilization-rollback|jalwa-web-staging|jalwa-worker-staging|jalwa-postgres-staging)\b'

section 'Post-cleanup capacity'
docker system df
df -hT /
use_pct="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
[[ "$use_pct" =~ ^[0-9]+$ ]]
if (( use_pct >= 85 )); then
  echo "Capacity gate still blocked: ${use_pct}% >= 85%" >&2
  exit 1
fi
echo "Capacity gate satisfied: ${use_pct}% < 85%"
