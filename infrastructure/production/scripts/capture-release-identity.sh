#!/usr/bin/env bash
set -Eeuo pipefail

release_sha="${1:?release SHA is required}"
build_pipeline_id="${2:?build pipeline ID is required}"
deployment_pipeline_id="${3:-$build_pipeline_id}"
root="${JALWA_ROOT:-/opt/jalwa}"
env_file="${JALWA_ENV_FILE:-$root/.env.production}"
compose_file="${JALWA_COMPOSE_FILE:-$root/docker-compose.yml}"
output_file="$root/deployments/${release_sha}.identity.json"
export COMPOSE_FILE="$compose_file"

[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Release SHA must be a 40-character lowercase Git commit SHA." >&2; exit 1; }
[[ "$build_pipeline_id" =~ ^[0-9]+$ ]] || { echo "Build pipeline ID must be numeric." >&2; exit 1; }
[[ "$deployment_pipeline_id" =~ ^[0-9]+$ ]] || { echo "Deployment pipeline ID must be numeric." >&2; exit 1; }
[[ -s "$env_file" ]] || { echo "Missing runtime environment." >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required for release identity capture." >&2; exit 1; }

cd "$root"

service_json() {
  local service="$1" repository="$2"
  local container_id image_id image_ref revision build_run_id repo_digest

  container_id="$(docker compose --env-file "$env_file" ps -q "$service")"
  [[ -n "$container_id" ]] || { echo "No running container found for $service." >&2; return 1; }

  image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
  image_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "Invalid running image ID for $service." >&2; return 1; }

  revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image_id")"
  build_run_id="$(docker image inspect --format '{{ index .Config.Labels "com.watch-jalwa.build-run-id" }}' "$image_id")"
  [[ "$revision" == "$release_sha" ]] || { echo "OCI revision mismatch for $service." >&2; return 1; }
  [[ "$build_run_id" == "$build_pipeline_id" ]] || { echo "Build pipeline label mismatch for $service." >&2; return 1; }

  repo_digest="$(docker image inspect --format '{{json .RepoDigests}}' "$image_id" | jq -r --arg prefix "${repository}@sha256:" '.[]? | select(startswith($prefix))' | head -n1)"
  [[ "$repo_digest" =~ ^${repository}@sha256:[0-9a-f]{64}$ ]] || { echo "Immutable repository digest missing for $service." >&2; return 1; }

  jq -n \
    --arg service "$service" \
    --arg configured_image "$image_ref" \
    --arg container_id "$container_id" \
    --arg image_id "$image_id" \
    --arg repo_digest "$repo_digest" \
    --arg oci_revision "$revision" \
    --arg build_run_id "$build_run_id" \
    '{service:$service,configured_image:$configured_image,container_id:$container_id,image_id:$image_id,repo_digest:$repo_digest,oci_revision:$oci_revision,build_run_id:$build_run_id}'
}

web="$(service_json web ghcr.io/watch-jalwa/jalwa-platform-web)"
worker="$(service_json worker ghcr.io/watch-jalwa/jalwa-platform-worker)"
rollback_release=""
if [[ -s "$root/.previous-good-image" ]]; then
  rollback_release="$(tr -d '[:space:]' < "$root/.previous-good-image")"
  [[ "$rollback_release" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid previous-good release marker." >&2; exit 1; }
fi

mkdir -p "$root/deployments"
temporary="${output_file}.tmp.$$"
jq -n \
  --arg schema_version "2" \
  --arg captured_at "$(date -u +%FT%TZ)" \
  --arg expected_source_sha "$release_sha" \
  --arg build_pipeline_id "$build_pipeline_id" \
  --arg deployment_pipeline_id "$deployment_pipeline_id" \
  --arg rollback_release "$rollback_release" \
  --argjson web "$web" \
  --argjson worker "$worker" \
  '{schema_version:$schema_version,captured_at:$captured_at,expected_source_sha:$expected_source_sha,build_pipeline_id:$build_pipeline_id,deployment_pipeline_id:$deployment_pipeline_id,rollback_release:($rollback_release | if length == 0 then null else . end),services:{web:$web,worker:$worker}}' > "$temporary"
chmod 600 "$temporary"
mv -f "$temporary" "$output_file"

echo "Release identity captured for ${release_sha}."
