#!/usr/bin/env bash
set -Eeuo pipefail
source ops/demo-four-20261106/connection.sh
if [ -z "${STAGING_QA_SECRET:-}" ]; then
  STAGING_QA_SECRET="$(staging_ssh 'docker exec jalwa-web-staging printenv STAGING_QA_SECRET')"
fi
test -n "$STAGING_QA_SECRET"
printf '::add-mask::%s\n' "$STAGING_QA_SECRET"
export STAGING_QA_SECRET
QA_SESSION_DIR="$(mktemp -d "$RUNNER_TEMP/qa-session-XXXXXX")"
chmod 700 "$QA_SESSION_DIR"
export QA_SESSION_DIR
trap 'rm -rf -- "$QA_SESSION_DIR"' EXIT
mkdir -p evidence
PREMIUM_QA_MODE=auth-only PREMIUM_QA_EVIDENCE=evidence/account.json node scripts/verify-four-premium.mjs
run="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
operate() {
  { node -e 'process.stdout.write("process.env.JALWA_FOUR_REVIEWS="+JSON.stringify(require("node:fs").readFileSync("ops/demo-four-20261106/review.json","utf8"))+";\n")'
    cat ops/demo-four-20261106/publish.mjs
  } | staging_ssh "docker exec -i -e JALWA_FOUR_MODE=$1 -e JALWA_FOUR_SLUG=$slug -e JALWA_FOUR_RUN=$run -e JALWA_FOUR_EXPECTED_SHA=$release jalwa-worker-staging node --input-type=module -"
}
failed=0
for slug in spring-blender caminandes-llamigos apollo-11-eagle-has-landed sprite-fright; do
  if [[ "$(jq -er --arg slug "$slug" '.[$slug].decision' ops/demo-four-20261106/review.json)" != clear ]]; then
    echo "PENDING_EDITORIAL $slug"
    failed=1
    continue
  fi
  if ! operate publish | tee "evidence/$slug-publication.log"; then
    failed=1
    operate rollback || exit 1
    continue
  fi
  if ! PREMIUM_QA_EVIDENCE="evidence/$slug.json" node scripts/verify-four-premium.mjs "$slug"; then
    failed=1
    operate rollback | tee "evidence/$slug-rollback.log" || exit 1
    if jq -e 'any(.playback[]; .pass == false and .mediaOrigin != null and .mediaOrigin != .origin and any(.transport[]?; contains("ERR_FAILED") or contains("no-cors-header")))' "evidence/$slug.json" >/dev/null; then
      echo "SHARED_GATEWAY_ORIGIN_FAILURE"
      break
    fi
  fi
done
exit "$failed"
