#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# == 0 )); then
  echo "Usage: $0 IMAGE [IMAGE ...]" >&2
  exit 64
fi

trivy_bin="${TRIVY_BIN:-${TRIVY_INSTALL_DIR:-$HOME/.local/bin}/trivy}"
report_dir="${TRIVY_REPORT_DIR:-/tmp/jalwa-trivy-reports}"
mkdir -p "$report_dir"

[[ -x "$trivy_bin" ]] || { echo "Trivy is not installed at $trivy_bin" >&2; exit 1; }

failure=0
for image in "$@"; do
  [[ -n "$image" ]] || continue
  safe_name="$(printf '%s' "$image" | tr '/:@' '____' | tr -cd 'a-zA-Z0-9._-')"
  report="$report_dir/${safe_name}.json"
  echo "Scanning $image for fixable HIGH and CRITICAL vulnerabilities"

  set +e
  "$trivy_bin" image \
    --scanners vuln \
    --pkg-types os,library \
    --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --exit-code 1 \
    --no-progress \
    --timeout 15m \
    --format json \
    --output "$report" \
    "$image"
  status=$?
  set -e

  if [[ ! -s "$report" ]]; then
    echo "Trivy did not produce a report for $image" >&2
    failure=1
    continue
  fi

  count="$(jq '[.Results[]?.Vulnerabilities[]?] | length' "$report")"
  jq -r '.Results[]? | .Target as $target | .Vulnerabilities[]? | "\(.Severity) \(.VulnerabilityID) \($target) \(.PkgName) \(.InstalledVersion) -> \(.FixedVersion // "unfixed")"' "$report" || true

  if (( status != 0 )); then
    echo "$image contains $count fixable HIGH/CRITICAL vulnerabilities." >&2
    failure=1
  else
    echo "$image passed with no fixable HIGH/CRITICAL vulnerabilities."
  fi
done

(( failure == 0 )) || exit 1
