#!/usr/bin/env bash
set -Eeuo pipefail
source ops/demo-four-20261106/connection.sh
if [ -z "${STAGING_QA_SECRET:-}" ]; then
  STAGING_QA_SECRET="$(staging_ssh 'docker exec jalwa-web-staging printenv STAGING_QA_SECRET')"
fi
test -n "$STAGING_QA_SECRET"
printf '::add-mask::%s\n' "$STAGING_QA_SECRET"
export STAGING_QA_SECRET
QA_SESSION_DIR="$(mktemp -d "$RUNNER_TEMP/cosmos-session-XXXXXX")"
chmod 700 "$QA_SESSION_DIR"
export QA_SESSION_DIR
trap 'rm -rf -- "$QA_SESSION_DIR"' EXIT
mkdir -p evidence
PREMIUM_QA_MODE=auth-only PREMIUM_QA_EVIDENCE=evidence/account.json node scripts/verify-four-premium.mjs cosmos-laundromat
run="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
operate() {
  local script=ops/demo-four-20261106/publish.mjs
  if [ "$1" = correct-licence ]; then script=ops/cosmos-20261106/correct-licence.mjs; fi
  { node -e 'process.stdout.write("process.env.JALWA_FOUR_REVIEWS="+JSON.stringify(require("node:fs").readFileSync("ops/cosmos-20261106/review.json","utf8"))+";\n")'
    cat "$script"
  } | staging_ssh "docker exec -i -e JALWA_FOUR_MODE=$1 -e JALWA_FOUR_SLUG=cosmos-laundromat -e JALWA_FOUR_RUN=$run -e JALWA_FOUR_EXPECTED_SHA=$release jalwa-worker-staging node --input-type=module -"
}
operate correct-licence | tee evidence/licence-correction.log
if ! operate publish | tee evidence/publication.log; then
  operate rollback | tee evidence/rollback.log
  exit 1
fi
if ! PREMIUM_QA_EVIDENCE=evidence/cosmos.json node scripts/verify-four-premium.mjs cosmos-laundromat; then
  operate rollback | tee evidence/rollback.log
  exit 1
fi
staging_ssh "docker exec -i -e RELEASE_SHA=$release jalwa-worker-staging node --input-type=module -" < ops/cosmos-20261106/final-status.mjs | tee evidence/final-status.json
jq -e '.playback | length == 2 and all(.[]; .pass and .enhanced and .seconds >= 15 and .decodedFrames >= 15)' evidence/cosmos.json
