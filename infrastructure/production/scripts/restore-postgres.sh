#!/usr/bin/env bash
set -Eeuo pipefail

backup="${1:-}"
if [[ -z "$backup" || ! -f "$backup" ]]; then
  echo "Usage: RESTORE_CONFIRM=RESTORE $0 /path/to/backup.dump" >&2
  exit 1
fi
if [[ "${RESTORE_CONFIRM:-}" != "RESTORE" ]]; then
  echo "Set RESTORE_CONFIRM=RESTORE to acknowledge the destructive restore." >&2
  exit 1
fi
if [[ ! -f "${backup}.sha256" ]]; then
  echo "Missing checksum file: ${backup}.sha256" >&2
  exit 1
fi

(cd "$(dirname "$backup")" && sha256sum --check "$(basename "${backup}.sha256")")

cd /opt/jalwa
docker compose --env-file .env.production stop web worker || true

cd /opt/jalwa/supabase/runtime
compose=(docker compose -f docker-compose.yml -f docker-compose.jalwa.yml)
"${compose[@]}" stop
"${compose[@]}" up -d db --wait

docker exec -i supabase-db pg_restore \
  -U postgres -d postgres --clean --if-exists --no-owner --no-acl < "$backup"

"${compose[@]}" up -d --wait
cd /opt/jalwa
docker compose --env-file .env.production up -d --remove-orphans

echo "Restore completed. Run smoke-test.sh before reopening traffic."
