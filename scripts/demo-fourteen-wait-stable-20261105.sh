#!/usr/bin/env bash
# SOURCE from a GitHub Action step after configuring pinned SSH.
# Tolerate brief web/worker container transitions while never mutating wrong release.
set -Eeuo pipefail
for DEMO_14_STABLE_ATTEMPT in $(seq 1 40); do
  if source scripts/demo-fourteen-refresh-release-20261105.sh; then
    echo "DEMO_14_DEPLOYMENT_STABLE attempt=$DEMO_14_STABLE_ATTEMPT sha=$DEMO_14_EXPECTED_SHA"
    break
  fi
  if [ "$((DEMO_14_STABLE_ATTEMPT % 5))" -eq 0 ]; then
    echo "DEMO_14_WAIT_FOR_SAME_RELEASE attempt=$DEMO_14_STABLE_ATTEMPT/40"
  fi
  if [ "$DEMO_14_STABLE_ATTEMPT" -eq 40 ]; then
    echo "DEMO_14_PRECHECK_TIMEOUT: Both public domains and worker not at same healthy SHA" >&2
    return 1
  fi
  sleep 10
done
unset DEMO_14_STABLE_ATTEMPT
