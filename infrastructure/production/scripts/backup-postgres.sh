#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="${ENV_FILE:-/opt/jalwa/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/jalwa/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
R2_BACKUP_BUCKET="${R2_BACKUP_BUCKET:-jalwa-backups}"

if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR}/jalwa-postgres-${timestamp}.dump"
checksum="${target}.sha256"

mkdir -p "$BACKUP_DIR"
umask 077

docker exec "$DB_CONTAINER" pg_isready -U postgres -d postgres >/dev/null
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --format=custom --no-owner --no-acl > "$target"
sha256sum "$target" > "$checksum"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$target" "s3://${R2_BACKUP_BUCKET}/postgres/$(basename "$target")" --only-show-errors
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$checksum" "s3://${R2_BACKUP_BUCKET}/postgres/$(basename "$checksum")" --only-show-errors

find "$BACKUP_DIR" -type f \( -name 'jalwa-postgres-*.dump' -o -name 'jalwa-postgres-*.dump.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
echo "Created and uploaded $target"
