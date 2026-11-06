#!/usr/bin/env bash
set -Eeuo pipefail
source ops/demo-four-20261106/connection.sh
staging_ssh 'bash -s' <<'REMOTE'
set -Eeuo pipefail
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-worker-staging)" = healthy
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 8388608
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 3145728
REMOTE
mkdir -p evidence
# Prefer the publisher's 720p original if its actual download endpoint confirms a bounded source.
candidate='https://video.blender.org/download/web-videos/f507dfdc-e73e-45a4-9778-d758cbe1ce96-720.mp4'
if curl -fsSI --max-time 20 "$candidate" > "$RUNNER_TEMP/source-head"; then
  bytes="$(awk 'tolower($1)=="content-length:" {gsub("\r","",$2);print $2}' "$RUNNER_TEMP/source-head" | tail -1)"
  if [[ "$bytes" =~ ^[0-9]+$ ]] && [ "$bytes" -ge 10000 ] && [ "$bytes" -le 367001600 ]; then
    jq --arg uri "$candidate" '(.titles[] | select(.slug=="cosmos-laundromat") | .uri)=$uri' \
      ops/jalwa-14-approved-official-sources-20261105.json > "$RUNNER_TEMP/source-manifest"
    cp "$RUNNER_TEMP/source-manifest" ops/jalwa-14-approved-official-sources-20261105.json
  fi
fi
jq '.titles[] | select(.slug=="cosmos-laundromat")' ops/jalwa-14-approved-official-sources-20261105.json > evidence/publisher-source.json
cat evidence/publisher-source.json
{ node -e 'process.stdout.write("process.env.DEMO_14_MANIFEST="+JSON.stringify(require("node:fs").readFileSync("ops/jalwa-14-approved-official-sources-20261105.json","utf8"))+";\n")'
  cat scripts/demo-fourteen-ingest-20261105.mjs
} | staging_ssh "docker exec -i -e DEMO_14_MODE=ingest -e DEMO_14_SLUG=cosmos-laundromat -e DEMO_14_EXPECTED_SHA=$release jalwa-worker-staging node --input-type=module -" | tee evidence/ingest.log
for attempt in $(seq 1 120); do
  status=0
  staging_ssh "docker exec -i -e DEMO_14_EXPECTED_SHA=$release jalwa-worker-staging node --input-type=module -" < ops/cosmos-20261106/state.mjs > evidence/state.log 2>&1 || status=$?
  cat evidence/state.log
  if [ "$status" = 0 ]; then exit 0; fi
  if [ "$status" != 3 ]; then exit "$status"; fi
  sleep 10
done
echo "COSMOS_ENCODING_TIMEOUT" >&2
exit 1
