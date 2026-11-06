#!/usr/bin/env bash
set -Eeuo pipefail
source ops/retained-repair-20261106/connection.sh
run="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
evidence_dir="/tmp/jalwa-retained-evidence-$run"
mkdir -p evidence
staging_ssh 'bash -s' <<'REMOTE'
set -Eeuo pipefail
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-worker-staging)" = healthy
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 8388608
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 3145728
REMOTE
for slug in vhs-static-cc0-clip sintel; do
  { node -e 'process.stdout.write("process.env.JALWA_REPAIR_ORIGINALS="+JSON.stringify(require("node:fs").readFileSync("ops/retained-repair-20261106/originals.json","utf8"))+";\n")'
    cat ops/retained-repair-20261106/repair.mjs
  } | staging_ssh "docker exec -i -e JALWA_REPAIR_MODE=repair -e JALWA_REPAIR_SLUG=$slug -e JALWA_REPAIR_RUN=$run -e JALWA_REPAIR_EXPECTED_SHA=$release -e JALWA_REPAIR_EVIDENCE_DIR=$evidence_dir jalwa-worker-staging node --input-type=module -" | tee "evidence/$slug-repair.log"
done
staging_ssh "docker exec jalwa-worker-staging tar -czf - -C $evidence_dir ." > "$RUNNER_TEMP/retained-evidence.tar.gz"
tar -xzf "$RUNNER_TEMP/retained-evidence.tar.gz" -C evidence
