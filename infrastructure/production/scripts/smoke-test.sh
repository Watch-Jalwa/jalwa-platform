#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://watch-jalwa.com}"
API_URL="${2:-https://api.watch-jalwa.com}"
EXPECTED_VERSION="${3:-${EXPECTED_VERSION:-}}"
BASE_URL="${BASE_URL%/}"
API_URL="${API_URL%/}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

check() {
  local url="$1"
  local expected="$2"
  local output="$3"
  local code
  code="$(curl --silent --show-error --location --output "$output" --write-out '%{http_code}' --max-time 20 "$url")"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL ${url}: expected ${expected}, received ${code}" >&2
    cat "$output" >&2 || true
    exit 1
  fi
  echo "PASS ${url} (${code})"
}

check "${BASE_URL}/api/health" "200" "$WORK_DIR/health.json"
check "${BASE_URL}/api/readiness" "200" "$WORK_DIR/readiness.json"
jq -e '.status == "ready" and .database == "ready" and .migrations == "ready"' "$WORK_DIR/readiness.json" >/dev/null || {
  echo "FAIL readiness payload does not report a fully ready service" >&2
  cat "$WORK_DIR/readiness.json" >&2
  exit 1
}
version="$(jq -r '.version // empty' "$WORK_DIR/readiness.json")"
[[ -n "$version" && "$version" != "local" ]] || {
  echo "FAIL readiness payload has no deployed version" >&2
  exit 1
}
if [[ -n "$EXPECTED_VERSION" && "$version" != "$EXPECTED_VERSION" ]]; then
  echo "FAIL deployed version mismatch: expected $EXPECTED_VERSION, received $version" >&2
  exit 1
fi

check "${BASE_URL}/" "200" "$WORK_DIR/home.html"
check "${BASE_URL}/pricing" "200" "$WORK_DIR/pricing.html"
check "${BASE_URL}/support" "200" "$WORK_DIR/support.html"
check "${BASE_URL}/legal/privacy" "200" "$WORK_DIR/privacy.html"
check "${API_URL}/auth/v1/health" "200" "$WORK_DIR/auth-health.json"

echo "Jalwa production smoke test passed for version ${version}."
