#!/usr/bin/env bash
set -Eeuo pipefail
source ops/demo-four-20261106/connection.sh
if [ -z "${STAGING_QA_SECRET:-}" ]; then
  STAGING_QA_SECRET="$(staging_ssh 'docker exec jalwa-web-staging printenv STAGING_QA_SECRET')"
fi
test -n "$STAGING_QA_SECRET"
printf '::add-mask::%s\n' "$STAGING_QA_SECRET"
export STAGING_QA_SECRET
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
  fi
done
exit "$failed"
