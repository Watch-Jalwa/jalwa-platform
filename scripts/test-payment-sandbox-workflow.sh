#!/usr/bin/env bash
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workflow="$repository_root/.github/workflows/payment-sandbox-certification-release.yml"

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

require() {
  local pattern="$1"
  local label="$2"
  grep -Fq -- "$pattern" "$workflow" || fail "$label"
}

require 'id: boundary' 'payment sandbox boundary step must expose an outcome'
require 'status: "BLOCKED"' 'blocked provider configuration must be recorded explicitly'
require 'production_charge_authorized: false' 'blocked evidence must prove no production charge authorization'
require 'staging_runtime_modified: false' 'blocked evidence must prove staging was not modified before the boundary'
require 'signed_webhook_lifecycle: "not_started"' 'blocked evidence must prove the provider lifecycle never started'
require '> "$PAYMENT_SANDBOX_EVIDENCE_FILE"' 'blocked evidence must be written to the retained report path'
require 'if: always()' 'sandbox evidence upload/final gate must remain unconditional after failures'
require 'BOUNDARY_OUTCOME: ${{ steps.boundary.outcome }}' 'final production gate must consume the boundary outcome'
require 'test "$BOUNDARY_OUTCOME" = success' 'production gate must remain blocked when provider boundary validation fails'
require 'test "$CONFIGURE_OUTCOME" = success' 'production gate must still require sandbox runtime configuration'
require 'test "$SANDBOX_OUTCOME" = success' 'production gate must still require sandbox lifecycle success'
require 'test "$RESTORE_OUTCOME" = success' 'production gate must still require restoration of certified mock staging'
require 'test "$EVIDENCE_OUTCOME" = success' 'production gate must still require validated PASS evidence'

printf 'PASS payment sandbox workflow retains BLOCKED evidence without weakening production gates\n'
