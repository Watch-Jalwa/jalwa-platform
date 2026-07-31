#!/usr/bin/env bash
set -Eeuo pipefail

image="${1:-jalwa-web:ci}"
expected_sha="${2:-${GITHUB_SHA:-0000000000000000000000000000000000000000}}"
container="jalwa-web-contract-${RANDOM}-${RANDOM}"
temporary_directory="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

fail() {
  echo "FAIL $*" >&2
  docker logs "$container" >&2 2>/dev/null || true
  exit 1
}

[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || fail "expected SHA must be a lowercase 40-character Git SHA"
healthcheck="$(docker image inspect --format '{{json .Config.Healthcheck.Test}}' "$image")"
[[ "$healthcheck" != "null" && "$healthcheck" != "[]" ]] || fail "image does not declare a health check"

container_id="$(docker run --detach --name "$container" \
  --publish 127.0.0.1::3000 \
  --env NODE_ENV=production \
  --env HOSTNAME=0.0.0.0 \
  --env PORT=3000 \
  --env GIT_SHA="$expected_sha" \
  "$image")"
[[ -n "$container_id" ]] || fail "container did not start"

binding="$(docker port "$container" 3000/tcp | head -1)"
port="${binding##*:}"
[[ "$port" =~ ^[0-9]+$ ]] || fail "could not resolve published container port"
base_url="http://127.0.0.1:${port}"

ready=false
for _ in $(seq 1 60); do
  if curl --silent --show-error --fail --max-time 2 "$base_url/api/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || fail "health endpoint did not become available"

curl --silent --show-error --fail --max-time 5 \
  --dump-header "$temporary_directory/health.headers" \
  --output "$temporary_directory/health.json" \
  "$base_url/api/health"

jq -e --arg expected "$expected_sha" \
  '.service == "jalwa-web" and .status == "ready" and .version == $expected' \
  "$temporary_directory/health.json" >/dev/null || fail "health response did not report the expected release identity"

grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' "$temporary_directory/health.headers" || fail "nosniff header is missing"
grep -Eiq '^x-frame-options:[[:space:]]*sameorigin' "$temporary_directory/health.headers" || fail "frame protection header is missing"
grep -Eiq '^referrer-policy:[[:space:]]*strict-origin-when-cross-origin' "$temporary_directory/health.headers" || fail "referrer policy header is missing"
if grep -Eiq '^x-powered-by:' "$temporary_directory/health.headers"; then
  fail "framework disclosure header is present"
fi

readiness_status="$(curl --silent --show-error --max-time 5 \
  --output "$temporary_directory/readiness.json" \
  --write-out '%{http_code}' \
  "$base_url/api/readiness")"
[[ "$readiness_status" == "503" ]] || fail "readiness must fail closed when production dependencies are absent"
jq -e --arg expected "$expected_sha" \
  '.service == "jalwa-web" and .status == "not_ready" and .version == $expected and (keys | sort == ["service","status","time","version"])' \
  "$temporary_directory/readiness.json" >/dev/null || fail "public readiness leaks diagnostics or has the wrong release identity"

internal_status="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' "$base_url/api/internal/readiness")"
[[ "$internal_status" == "401" ]] || fail "internal readiness is not protected"

running_user="$(docker inspect --format '{{.Config.User}}' "$container")"
[[ "$running_user" == "node" ]] || fail "runtime container user is not node"

printf 'PASS production web image boots, reports its release, limits readiness diagnostics and fails readiness closed\n'
