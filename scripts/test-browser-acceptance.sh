#!/usr/bin/env bash
set -Eeuo pipefail

image="${1:-jalwa-web:ci}"
expected_sha="${2:-${GITHUB_SHA:-0000000000000000000000000000000000000000}}"
container="jalwa-browser-acceptance-${RANDOM}-${RANDOM}"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL $*" >&2
  docker logs "$container" >&2 2>/dev/null || true
  exit 1
}

[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || fail "expected SHA must be a lowercase 40-character Git SHA"
node -e "require.resolve('@playwright/test')" >/dev/null || fail "@playwright/test is not installed"

container_id="$(docker run --detach --name "$container" \
  --publish 127.0.0.1::3000 \
  --read-only \
  --tmpfs /tmp:size=128m,mode=1777 \
  --tmpfs /app/apps/web/.next/cache:size=256m,mode=1777 \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --pids-limit 256 \
  --env NODE_ENV=production \
  --env HOSTNAME=0.0.0.0 \
  --env PORT=3000 \
  --env GIT_SHA="$expected_sha" \
  --env NEXT_PUBLIC_FRONTEND_PREVIEW=true \
  --env VERCEL_ENV=preview \
  "$image")"
[[ -n "$container_id" ]] || fail "browser acceptance container did not start"

binding="$(docker port "$container" 3000/tcp | head -1)"
port="${binding##*:}"
[[ "$port" =~ ^[0-9]+$ ]] || fail "could not resolve published browser acceptance port"
base_url="http://127.0.0.1:${port}"

ready=false
for _ in $(seq 1 60); do
  if curl --silent --show-error --fail --max-time 2 "$base_url/api/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || fail "browser acceptance application did not become healthy"

JALWA_BROWSER_BASE_URL="$base_url" node scripts/browser-acceptance.mjs || fail "browser journeys failed"
printf 'PASS production image browser acceptance journeys\n'
