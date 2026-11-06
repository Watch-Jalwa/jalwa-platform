#!/usr/bin/env bash
set -Eeuo pipefail
source ops/retained-repair-20261106/connection.sh
if [ -z "${STAGING_QA_SECRET:-}" ]; then
  STAGING_QA_SECRET="$(staging_ssh 'docker exec jalwa-web-staging printenv STAGING_QA_SECRET')"
fi
test -n "$STAGING_QA_SECRET"
printf '::add-mask::%s\n' "$STAGING_QA_SECRET"
export STAGING_QA_SECRET
QA_SESSION_DIR="$(mktemp -d "$RUNNER_TEMP/retained-session-XXXXXX")"
chmod 700 "$QA_SESSION_DIR"
export QA_SESSION_DIR
trap 'rm -rf -- "$QA_SESSION_DIR"' EXIT
mkdir -p evidence
staging_ssh "docker exec -i jalwa-worker-staging node --input-type=module - /app/apps/worker/src/media.mjs" < ops/retained-repair-20261106/synthetic-regression.mjs > evidence/encoder-regression.json
PREMIUM_QA_MODE=auth-only PREMIUM_QA_EVIDENCE=evidence/account.json node ops/retained-repair-20261106/verify-premium.mjs
run="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
operate() {
  { node -e 'const fs=require("node:fs");for(const [name,file] of [["JALWA_REPAIR_REVIEWS","review.json"],["JALWA_REPAIR_ORIGINALS","originals.json"]])process.stdout.write("process.env."+name+"="+JSON.stringify(fs.readFileSync("ops/retained-repair-20261106/"+file,"utf8"))+";\n")'
    cat ops/retained-repair-20261106/publish.mjs
  } | staging_ssh "docker exec -i -e JALWA_REPAIR_MODE=$1 -e JALWA_REPAIR_SLUG=$2 -e JALWA_REPAIR_RUN=$run -e JALWA_REPAIR_EXPECTED_SHA=$release jalwa-worker-staging node --input-type=module -"
}
for slug in vhs-static-cc0-clip sintel; do
  if ! operate publish "$slug" | tee "evidence/$slug-publication.log"; then
    operate rollback "$slug" | tee "evidence/$slug-rollback.log"
    exit 1
  fi
  if ! PREMIUM_QA_EVIDENCE="evidence/$slug-playback.json" PREMIUM_QA_SCREENSHOT_DIR=evidence node ops/retained-repair-20261106/verify-premium.mjs "$slug"; then
    operate rollback "$slug" | tee "evidence/$slug-rollback.log"
    exit 1
  fi
done
{ node -e 'process.stdout.write("process.env.JALWA_REPAIR_ORIGINALS="+JSON.stringify(require("node:fs").readFileSync("ops/retained-repair-20261106/originals.json","utf8"))+";\n")'
  cat ops/retained-repair-20261106/final-status.mjs
} | staging_ssh "docker exec -i -e RELEASE_SHA=$release jalwa-worker-staging node --input-type=module -" | tee evidence/final-status.json
jq -es '[.[].playback[]] | length == 4 and all(.[]; .pass and .enhanced and .aspectPreserved and .seconds >= 15 and .decodedFrames >= 15)' evidence/*-playback.json
staging_ssh 'docker exec jalwa-worker-staging rm -rf -- /tmp/jalwa-repair-20261106/301b706e-9bf9-437a-9506-6c1cf27754d6 /tmp/jalwa-repair-20261106/5c5f576c-d1d6-4898-9bd5-2e3616fd0001'
printf 'Removed verified local processing caches. Retained R2 originals remain recorded in final-status.json.\n'
