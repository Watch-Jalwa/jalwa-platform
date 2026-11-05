#!/usr/bin/env bash
# SOURCE this file from the GH Action after pinned SSH setup.
# Read-only: prove both public demo sites and worker match the current exact SHA.
# Never infer authorization from a single domain or change payment/rights state.
set -Eeuo pipefail
test "${USER:-}" = "codistan" || return 1
test "${APP_DIR:-}" = "/opt/codistan/jalwa-platform" || return 1
local_a="$(curl -fsS --connect-timeout 6 --max-time 14 https://watch-jalwa.com/api/health)" || return 1
local_b="$(curl -fsS --connect-timeout 6 --max-time 14 https://jalwa-platform.codistan.org/api/health)" || return 1
for obj in "$local_a" "$local_b"; do
  test "$(jq -r '.status // ""' <<<"$obj")" = ready || return 1
done
sha="$(jq -r '.version // ""' <<<"$local_a")"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || return 1
test "$sha" = "$(jq -r '.version // ""' <<<"$local_b")" || return 1
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=5 -i ~/.ssh/jalwa \
    "$USER@$HOST" \
    "docker exec -e DEMO_14_EXPECTED_SHA=$sha jalwa-worker-staging node -e 'const e=process.env;if(e.DEPLOYMENT_ENVIRONMENT!==\"staging\"||e.PAYMENT_PROVIDER!==\"mock\"||e.MEDIA_BACKEND!==\"r2\"||e.GIT_SHA!==e.DEMO_14_EXPECTED_SHA)process.exit(1);'" \
    || return 1
export DEMO_14_EXPECTED_SHA="$sha"
if [ -n "${GITHUB_ENV:-}" ]; then echo "DEMO_14_EXPECTED_SHA=$sha" >> "$GITHUB_ENV"; fi
echo "DEMO_14_SAME_RELEASE_CONFIRMED $sha"
