#!/usr/bin/env bash
set -Eeuo pipefail

: "${DOMAIN:?DOMAIN is required}"
: "${CRON_SECRET:?CRON_SECRET is required}"

curl --fail-with-body --silent --show-error \
  --retry 3 --retry-all-errors --connect-timeout 15 --max-time 600 \
  -X POST "https://${DOMAIN}/api/cron/source-health" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H 'Content-Type: application/json'
