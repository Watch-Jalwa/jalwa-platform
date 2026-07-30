#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://watch-jalwa.com}"
BASE_URL="${BASE_URL%/}"

check() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl --silent --show-error --location --output /tmp/jalwa-smoke-body --write-out '%{http_code}' --max-time 20 "${BASE_URL}${path}")"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL ${path}: expected ${expected}, received ${code}" >&2
    cat /tmp/jalwa-smoke-body >&2 || true
    exit 1
  fi
  echo "PASS ${path} (${code})"
}

check "/api/health" "200"
check "/api/readiness" "200"
check "/" "200"
check "/pricing" "200"
check "/support" "200"
check "/legal/privacy" "200"

echo "Jalwa production smoke test passed."
