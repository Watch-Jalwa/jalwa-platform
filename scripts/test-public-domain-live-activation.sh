#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script="$repo_root/infrastructure/production/scripts/set-public-domain-live-sources.sh"
release_sha="1f9577855a90fa4157d4a6104ffceea26f5ffb95"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
root="$tmp/jalwa"
fakebin="$tmp/bin"
mkdir -p "$root/scripts" "$fakebin"

cat > "$fakebin/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "${JALWA_ROOT:?}/docker.log"
EOF
chmod +x "$fakebin/docker"

cat > "$root/scripts/smoke-test.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$1" == "https://staging.example.com" ]]
[[ "$2" == "https://api.staging.example.com" ]]
[[ "$3" == "1f9577855a90fa4157d4a6104ffceea26f5ffb95" ]]
[[ ! -e "${JALWA_ROOT:?}/fail-smoke" ]]
EOF
chmod +x "$root/scripts/smoke-test.sh"

cat > "$root/scripts/run-source-health.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$DOMAIN" == "staging.example.com" ]]
[[ "$CRON_SECRET" == "test-cron-secret" ]]
printf 'passed\n' > "${JALWA_ROOT:?}/source-health.log"
EOF
chmod +x "$root/scripts/run-source-health.sh"

write_environment() {
  cat > "$root/.env.production" <<EOF
NODE_ENV=production
DEPLOYMENT_ENVIRONMENT=staging
DOMAIN=staging.example.com
CRON_SECRET=test-cron-secret
JALWA_IMAGE_TAG=$release_sha
GIT_SHA=$release_sha
EOF
  chmod 600 "$root/.env.production"
}

run_activation() {
  JALWA_ROOT="$root" PATH="$fakebin:$PATH" bash "$script" "$@"
}

write_environment
run_activation true "$release_sha" staging.example.com staging
grep -qx 'PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=true' "$root/.env.production"
[[ "$(grep -c '^PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=' "$root/.env.production")" -eq 1 ]]
grep -qx 'enabled=true' "$root/.public-domain-live-sources"
grep -qx 'passed' "$root/source-health.log"
grep -q -- '--force-recreate web worker caddy' "$root/docker.log"

run_activation false "$release_sha" staging.example.com staging
grep -qx 'PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=false' "$root/.env.production"
[[ "$(grep -c '^PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=' "$root/.env.production")" -eq 1 ]]
grep -qx 'enabled=false' "$root/.public-domain-live-sources"

if run_activation true 0000000000000000000000000000000000000000 staging.example.com staging >/dev/null 2>&1; then
  echo 'Mismatched release SHA was accepted.' >&2
  exit 1
fi
grep -qx 'PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=false' "$root/.env.production"

if run_activation true "$release_sha" staging.example.com production >/dev/null 2>&1; then
  echo 'Mismatched deployment environment was accepted.' >&2
  exit 1
fi
grep -qx 'PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=false' "$root/.env.production"

touch "$root/fail-smoke"
if run_activation true "$release_sha" staging.example.com staging >/dev/null 2>&1; then
  echo 'Failed smoke test did not fail activation.' >&2
  exit 1
fi
grep -qx 'PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED=false' "$root/.env.production"
rm -f "$root/fail-smoke"

printf 'Public-domain live activation contract passed.\n'