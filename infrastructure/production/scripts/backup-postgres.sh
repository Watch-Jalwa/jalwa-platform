#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/opt/jalwa/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/jalwa-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
umask 077
pg_dump --format=custom --no-owner --no-acl --file "$TARGET" "$DATABASE_URL"
sha256sum "$TARGET" > "${TARGET}.sha256"
find "$BACKUP_DIR" -type f \( -name 'jalwa-*.dump' -o -name 'jalwa-*.dump.sha256' \) -mtime "+${RETENTION_DAYS}" -delete

echo "Created ${TARGET}"
