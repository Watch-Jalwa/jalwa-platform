#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://watch-jalwa.com}"
API_URL="${2:-https://api.watch-jalwa.com}"
BASE_URL="${BASE_URL%/}"
API_URL="${API_URL%/}"

check() {
  local url="$1"
  local expected="$2"
  local code
  code="$(curl --silent --show-error --location --output /tmp/jalwa-smoke-body --write-out '%{http_code}' --max-time 20 "$url")"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL ${url}: expected ${expected}, received ${code}" >&2
    cat /tmp/jalwa-smoke-body >&2 || true
    exit 1
  fi
  echo "PASS ${url} (${code})"
}

check "${BASE_URL}/api/health" "200"
check "${BASE_URL}/api/readiness" "200"
check "${BASE_URL}/" "200"
check "${BASE_URL}/pricing" "200"
check "${BASE_URL}/support" "200"
check "${BASE_URL}/legal/privacy" "200"
check "${API_URL}/auth/v1/health" "200"

echo "Jalwa production smoke test passed."
