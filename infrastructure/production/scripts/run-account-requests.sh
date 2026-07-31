#!/usr/bin/env bash
set -Eeuo pipefail

: "${DOMAIN:?DOMAIN is required}"
: "${ACCOUNT_REQUEST_PROCESSOR_SECRET:?ACCOUNT_REQUEST_PROCESSOR_SECRET is required}"

curl --fail-with-body --silent --show-error \
  --retry 3 --retry-all-errors --connect-timeout 15 --max-time 900 \
  -X POST "https://${DOMAIN}/api/internal/account-requests/process" \
  -H "Authorization: Bearer ${ACCOUNT_REQUEST_PROCESSOR_SECRET}" \
  -H 'Content-Type: application/json'
