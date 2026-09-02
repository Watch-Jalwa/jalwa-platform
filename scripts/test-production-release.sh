#!/usr/bin/env bash
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sut="$repository_root/infrastructure/production/scripts/deploy-release.sh"
old_sha="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
new_sha="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
temporary_roots=()

cleanup() {
  local directory
  for directory in "${temporary_roots[@]}"; do
    rm -rf "$directory"
  done
}
trap cleanup EXIT

fail() {
  printf 'FAIL %s\n' "$*" >&2
  exit 1
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  [[ "$actual" == "$expected" ]] || fail "$label: expected '$expected', received '$actual'"
}

env_value() {
  local file="$1"
  local name="$2"
  awk -F= -v name="$name" '$1 == name { print substr($0, index($0, "=") + 1); exit }' "$file"
}

prepare_case() {
  local root="$1"
  mkdir -p "$root/bin" "$root/scripts"
  cat > "$root/.env.production" <<EOF
NODE_ENV=production
JALWA_IMAGE_TAG=$old_sha
GIT_SHA=$old_sha
EOF
  cat > "$root/docker-compose.yml" <<'EOF'
services: {}
EOF
  cat > "$root/docker-compose.onprem.yml" <<'EOF'
services: {}
EOF
  printf '%s\n' "$old_sha" > "$root/.last-good-image"

  cat > "$root/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >> "${DOCKER_LOG:?}"
EOF
  chmod +x "$root/bin/docker"

  cat > "$root/scripts/smoke-test.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
expected="${3:?expected release version is required}"
env_file="${JALWA_ENV_FILE:-${JALWA_ROOT:?}/.env.production}"
image="$(awk -F= '$1 == "JALWA_IMAGE_TAG" { print $2; exit }' "$env_file")"
version="$(awk -F= '$1 == "GIT_SHA" { print $2; exit }' "$env_file")"
[[ "$image" == "$expected" ]]
[[ "$version" == "$expected" ]]
if [[ "${FAIL_ON_VERSION:-}" == "$expected" ]]; then
  exit 42
fi
EOF
  chmod +x "$root/scripts/smoke-test.sh"
}

success_root="$(mktemp -d)"
temporary_roots+=("$success_root")
prepare_case "$success_root"
DOCKER_LOG="$success_root/docker.log" JALWA_ROOT="$success_root" PATH="$success_root/bin:$PATH" \
  bash "$sut" "$new_sha" "example.test"
assert_equal "$new_sha" "$(env_value "$success_root/.env.production" JALWA_IMAGE_TAG)" "successful image tag"
assert_equal "$new_sha" "$(env_value "$success_root/.env.production" GIT_SHA)" "successful release version"
assert_equal "$new_sha" "$(tr -d '[:space:]' < "$success_root/.last-good-image")" "last-good marker"
grep -q "$new_sha" "$success_root/.last-successful-deploy" || fail "successful deployment marker does not contain the release SHA"
grep -q '^compose .* pull$' "$success_root/docker.log" || fail "successful deployment did not pull images"
grep -q '^compose .* up -d --remove-orphans$' "$success_root/docker.log" || fail "successful deployment did not start the stack"
printf 'PASS successful deployment updates image and version atomically\n'

staging_root="$(mktemp -d)"
temporary_roots+=("$staging_root")
prepare_case "$staging_root"
cp "$staging_root/.env.production" "$staging_root/.env.staging"
DOCKER_LOG="$staging_root/docker.log" JALWA_ROOT="$staging_root" JALWA_ENV_FILE="$staging_root/.env.staging" \
JALWA_COMPOSE_FILE="$staging_root/docker-compose.yml:$staging_root/docker-compose.onprem.yml" \
JALWA_COMPOSE_SERVICES="web worker" JALWA_DEPLOY_NO_DEPS=true PATH="$staging_root/bin:$PATH" \
  bash "$sut" "$new_sha" "staging.example.test"
assert_equal "$new_sha" "$(env_value "$staging_root/.env.staging" JALWA_IMAGE_TAG)" "staging image tag"
assert_equal "$old_sha" "$(env_value "$staging_root/.env.production" JALWA_IMAGE_TAG)" "production file remains untouched"
grep -q 'pull web worker' "$staging_root/docker.log" || fail "on-prem staging did not pull selected application services"
grep -q 'up -d --remove-orphans --no-deps web worker' "$staging_root/docker.log" || fail "on-prem staging did not preserve database dependencies"
printf 'PASS on-prem staging deployment preserves the production environment and existing database dependency\n'

rollback_root="$(mktemp -d)"
temporary_roots+=("$rollback_root")
prepare_case "$rollback_root"
set +e
DOCKER_LOG="$rollback_root/docker.log" JALWA_ROOT="$rollback_root" PATH="$rollback_root/bin:$PATH" FAIL_ON_VERSION="$new_sha" \
  bash "$sut" "$new_sha" "example.test"
rollback_status=$?
set -e
[[ "$rollback_status" -ne 0 ]] || fail "failed release unexpectedly returned success"
assert_equal "$old_sha" "$(env_value "$rollback_root/.env.production" JALWA_IMAGE_TAG)" "rollback image tag"
assert_equal "$old_sha" "$(env_value "$rollback_root/.env.production" GIT_SHA)" "rollback release version"
assert_equal "$old_sha" "$(tr -d '[:space:]' < "$rollback_root/.last-good-image")" "rollback last-good marker"
[[ ! -e "$rollback_root/.last-successful-deploy" ]] || fail "failed deployment wrote a success marker"
grep -q 'pull web worker' "$rollback_root/docker.log" || fail "rollback did not pull the previous application images"
grep -q 'up -d --remove-orphans web worker caddy' "$rollback_root/docker.log" || fail "rollback did not restore application services"
printf 'PASS failed deployment restores image and reported version\n'

invalid_root="$(mktemp -d)"
temporary_roots+=("$invalid_root")
prepare_case "$invalid_root"
set +e
DOCKER_LOG="$invalid_root/docker.log" JALWA_ROOT="$invalid_root" PATH="$invalid_root/bin:$PATH" \
  bash "$sut" "latest" "example.test" >/dev/null 2>&1
invalid_status=$?
set -e
[[ "$invalid_status" -ne 0 ]] || fail "non-immutable image tag was accepted"
assert_equal "$old_sha" "$(env_value "$invalid_root/.env.production" JALWA_IMAGE_TAG)" "invalid-input image tag"
assert_equal "$old_sha" "$(env_value "$invalid_root/.env.production" GIT_SHA)" "invalid-input release version"
printf 'PASS deployment rejects mutable or malformed image tags\n'

echo "Production release integrity tests passed."
