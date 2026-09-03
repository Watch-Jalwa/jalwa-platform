#!/usr/bin/env bash
set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sut="$repository_root/infrastructure/production/scripts/host-acceptance.sh"
release_sha="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
temporary_roots=()

cleanup() {
  local directory
  for directory in "${temporary_roots[@]}"; do rm -rf "$directory"; done
}
trap cleanup EXIT

fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }

prepare_case() {
  local root="$1"
  mkdir -p "$root/bin" "$root/scripts" "$root/backups/postgres"
  cat > "$root/.env.staging" <<EOF
JALWA_IMAGE_TAG=$release_sha
GIT_SHA=$release_sha
DEPLOYMENT_ENVIRONMENT=staging
POSTGRES_USER=postgres
POSTGRES_DB=postgres
R2_BACKUP_BUCKET=test-backups
R2_ACCESS_KEY_ID=test-access
R2_SECRET_ACCESS_KEY=test-secret
BETTER_AUTH_SECRET=test-auth
SMTP_HOST=smtp.example.test
PAYMENT_PROVIDER=mock
ALLOW_MOCK_PAYMENTS=true
EOF
  printf 'services: {}\n' > "$root/docker-compose.yml"
  printf '%s health-test\n' "$(date -u +%FT%TZ)" > "$root/backups/postgres/LAST_SUCCESS"
  printf '%s restore-test\n' "$(date -u +%FT%TZ)" > "$root/backups/postgres/LAST_RESTORE_DRILL"

  cat > "$root/scripts/smoke-test.sh" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
exit 0
EOF
  chmod +x "$root/scripts/smoke-test.sh"

  cat > "$root/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1" == compose ]]; then
  shift
  joined=" $* "
  if [[ "$joined" == *" ps -q "* ]]; then
    printf 'id-%s\n' "${!#}"
  fi
  exit 0
fi
if [[ "$1" == inspect ]]; then
  id="${!#}"
  joined=" $* "
  if [[ "$joined" == *"State.Running"* ]]; then
    echo true
  elif [[ "$joined" == *"State.Health"* ]]; then
    if [[ "$id" == id-postgres ]]; then echo "${POSTGRES_HEALTH:-none}"; else echo healthy; fi
  fi
  exit 0
fi
if [[ "$1" == exec ]]; then
  joined=" $* "
  if [[ "$joined" == *" pg_isready "* ]]; then
    [[ "${FAIL_PG_READY:-false}" != true ]]
    exit $?
  fi
  if [[ "$joined" == *" psql "* ]]; then echo 0; exit 0; fi
fi
printf 'Unexpected docker invocation: %s\n' "$*" >&2
exit 97
EOF
  chmod +x "$root/bin/docker"

  cat > "$root/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$root/bin/systemctl"

  cat > "$root/bin/curl" <<EOF
#!/usr/bin/env bash
printf '{"version":"$release_sha"}\n'
EOF
  chmod +x "$root/bin/curl"

  cat > "$root/bin/jq" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
sed -n 's/.*"version":"\([^"]*\)".*/\1/p'
EOF
  chmod +x "$root/bin/jq"
}

success_root="$(mktemp -d)"
temporary_roots+=("$success_root")
prepare_case "$success_root"
PATH="$success_root/bin:$PATH" APP_DIR="$success_root" DB_CONTAINER=jalwa-postgres-staging \
JALWA_ENV_FILE="$success_root/.env.staging" JALWA_COMPOSE_FILE="$success_root/docker-compose.yml" \
JALWA_EXPECT_SERVICES='postgres web worker' JALWA_SKIP_EDGE_CHECKS=true POSTGRES_HEALTH=none FAIL_PG_READY=false \
  bash "$sut" 'http://127.0.0.1:3001' > "$success_root/output.log"
grep -q 'PASS postgres (none)' "$success_root/output.log" || fail 'PostgreSQL without Docker health metadata was not accepted after pg_isready passed'
grep -q 'PASS PostgreSQL and migration ledger' "$success_root/output.log" || fail 'PostgreSQL readiness/migration acceptance did not complete'
printf 'PASS PostgreSQL without Docker health metadata is accepted only when pg_isready succeeds\n'

unready_root="$(mktemp -d)"
temporary_roots+=("$unready_root")
prepare_case "$unready_root"
set +e
PATH="$unready_root/bin:$PATH" APP_DIR="$unready_root" DB_CONTAINER=jalwa-postgres-staging \
JALWA_ENV_FILE="$unready_root/.env.staging" JALWA_COMPOSE_FILE="$unready_root/docker-compose.yml" \
JALWA_EXPECT_SERVICES='postgres web worker' JALWA_SKIP_EDGE_CHECKS=true POSTGRES_HEALTH=none FAIL_PG_READY=true \
  bash "$sut" 'http://127.0.0.1:3001' > "$unready_root/output.log" 2>&1
unready_status=$?
set -e
[[ "$unready_status" -ne 0 ]] || fail 'PostgreSQL without Docker health metadata was accepted when pg_isready failed'
grep -q 'no Docker healthcheck and pg_isready failed' "$unready_root/output.log" || fail 'pg_isready failure was not reported clearly'
printf 'PASS PostgreSQL without Docker health metadata still fails closed when pg_isready fails\n'

unhealthy_root="$(mktemp -d)"
temporary_roots+=("$unhealthy_root")
prepare_case "$unhealthy_root"
set +e
PATH="$unhealthy_root/bin:$PATH" APP_DIR="$unhealthy_root" DB_CONTAINER=jalwa-postgres-staging \
JALWA_ENV_FILE="$unhealthy_root/.env.staging" JALWA_COMPOSE_FILE="$unhealthy_root/docker-compose.yml" \
JALWA_EXPECT_SERVICES='postgres web worker' JALWA_SKIP_EDGE_CHECKS=true POSTGRES_HEALTH=unhealthy FAIL_PG_READY=false \
  bash "$sut" 'http://127.0.0.1:3001' > "$unhealthy_root/output.log" 2>&1
unhealthy_status=$?
set -e
[[ "$unhealthy_status" -ne 0 ]] || fail 'Explicit Docker unhealthy state was incorrectly overridden by pg_isready'
grep -q 'Service unhealthy: postgres (unhealthy)' "$unhealthy_root/output.log" || fail 'Explicit unhealthy Docker state was not reported'
printf 'PASS explicit PostgreSQL Docker unhealthy state remains fail-closed\n'

echo 'Host acceptance health tests passed.'
