#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-${BASE_URL:-https://watch-jalwa.com}}"
BASE_URL="${BASE_URL%/}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
MIN_CONTENT_ITEMS="${MIN_CONTENT_ITEMS:-100}"
REPORT_FILE="${REPORT_FILE:-/tmp/jalwa-production-acceptance.json}"

command -v curl >/dev/null
command -v jq >/dev/null
[[ "$MIN_CONTENT_ITEMS" =~ ^[0-9]+$ ]] || { echo "MIN_CONTENT_ITEMS must be numeric" >&2; exit 2; }

pass=0
check_code() {
  local path="$1" expected="$2" code
  code="$(curl -sSLo /tmp/jalwa-acceptance-body -w '%{http_code}' --max-time 25 "${BASE_URL}${path}")"
  [[ "$code" == "$expected" ]] || { echo "FAIL ${path}: expected ${expected}, got ${code}" >&2; cat /tmp/jalwa-acceptance-body >&2 || true; exit 1; }
  pass=$((pass + 1))
}

for path in /api/health /api/readiness / /pricing /signup /login /support /legal/privacy /legal/terms; do check_code "$path" 200; done

readiness="$(curl -fsS --max-time 25 "${BASE_URL}/api/readiness")"
jq -e '.status == "ready" and .database == "ready" and (.missingConfiguration | length == 0)' <<<"$readiness" >/dev/null
jq -e '.paymentProvider != "mock" and .paymentProvider != "unconfigured"' <<<"$readiness" >/dev/null
jq -e '.frontendPreview == false' <<<"$readiness" >/dev/null
pass=$((pass + 3))

headers="$(mktemp)"
trap 'rm -f "$headers" /tmp/jalwa-acceptance-body /tmp/jalwa-content-headers /tmp/jalwa-content-body' EXIT
curl -fsS -D "$headers" -o /tmp/jalwa-acceptance-body --max-time 25 "$BASE_URL/"
grep -Eiq '^strict-transport-security: .*max-age=' "$headers"
grep -Eiq '^x-content-type-options: *nosniff' "$headers"
grep -Eiq '^referrer-policy: *strict-origin-when-cross-origin' "$headers"
! grep -Eiq 'noindex' /tmp/jalwa-acceptance-body
pass=$((pass + 4))

api_base="${BASE_URL/https:\/\//https://api.}"
auth_status="$(curl -sS -o /tmp/jalwa-acceptance-body -w '%{http_code}' --max-time 25 "${api_base}/auth/v1/health")"
[[ "$auth_status" == "200" ]] || { echo "FAIL auth health: ${auth_status}" >&2; cat /tmp/jalwa-acceptance-body >&2 || true; exit 1; }
pass=$((pass + 1))

curl -fsS -D /tmp/jalwa-content-headers -o /tmp/jalwa-content-body --max-time 25 -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" -H 'Prefer: count=exact' -H 'Range: 0-0' "${api_base}/rest/v1/content_items?select=id&status=eq.published"
content_range="$(awk 'BEGIN{IGNORECASE=1} /^content-range:/ {gsub("\r", ""); print $2}' /tmp/jalwa-content-headers | tail -n1)"
content_total="${content_range##*/}"
[[ "$content_total" =~ ^[0-9]+$ ]] || { echo "Could not determine published content count" >&2; cat /tmp/jalwa-content-headers >&2; exit 1; }
(( content_total >= MIN_CONTENT_ITEMS )) || { echo "Published catalogue has ${content_total}; minimum is ${MIN_CONTENT_ITEMS}" >&2; exit 1; }
pass=$((pass + 1))

category_count="$(curl -fsS --max-time 25 -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" "${api_base}/rest/v1/categories?select=slug&is_active=eq.true" | jq 'length')"
(( category_count >= 10 )) || { echo "Only ${category_count} active categories found" >&2; exit 1; }
pass=$((pass + 1))

jq -n --arg baseUrl "$BASE_URL" --argjson checks "$pass" --argjson publishedContent "$content_total" --argjson categories "$category_count" --arg version "$(jq -r '.version' <<<"$readiness")" '{status:"passed",baseUrl:$baseUrl,checks:$checks,publishedContent:$publishedContent,categories:$categories,version:$version,completedAt:(now|todateiso8601)}' | tee "$REPORT_FILE"
