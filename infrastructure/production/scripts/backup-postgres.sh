#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/opt/jalwa/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/jalwa/backups/postgres}"
LOCAL_RETENTION_DAYS="${BACKUP_LOCAL_RETENTION_DAYS:-14}"
REMOTE_RETENTION_DAYS="${BACKUP_REMOTE_RETENTION_DAYS:-35}"
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
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"
: "${BACKUP_KEY_VERSION:?BACKUP_KEY_VERSION is required}"
command -v age >/dev/null || { echo "age is required for backup encryption." >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo "A PostgreSQL backup is already running." >&2; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
reason="$(printf '%s' "${BACKUP_REASON:-scheduled}" | tr -cs 'a-zA-Z0-9._-' '-' | cut -c1-40)"
base="${BACKUP_DIR}/jalwa-postgres-${timestamp}-${reason}"
plaintext="${base}.dump.partial"
target="${base}.dump.age"
checksum="${target}.sha256"
metadata="${target}.json"
cleanup_failed() { rm -f "$plaintext" "$target" "$checksum" "$metadata"; }
trap cleanup_failed ERR EXIT

docker exec "$DB_CONTAINER" pg_isready -U postgres -d postgres >/dev/null
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --format=custom --compress=6 --no-owner --no-acl > "$plaintext"
test -s "$plaintext"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$plaintext" >/dev/null
plaintext_sha256="$(sha256sum "$plaintext" | cut -d' ' -f1)"
age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$target" "$plaintext"
test -s "$target"
rm -f "$plaintext"
sha256sum "$target" > "$checksum"
size_bytes="$(stat -c %s "$target")"
sha256="$(cut -d' ' -f1 "$checksum")"
jq -nc --arg createdAt "$(date -u +%FT%TZ)" --arg reason "$reason" --arg sha256 "$sha256" --arg plaintextSha256 "$plaintext_sha256" --arg keyVersion "$BACKUP_KEY_VERSION" --argjson sizeBytes "$size_bytes" \
  '{createdAt:$createdAt,reason:$reason,database:"postgres",sha256:$sha256,plaintextSha256:$plaintextSha256,sizeBytes:$sizeBytes,format:"age+pg_dump_custom",encryption:{scheme:"age-x25519",keyVersion:$keyVersion}}' > "$metadata"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
for artifact in "$target" "$checksum" "$metadata"; do
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "$artifact" "s3://${R2_BACKUP_BUCKET}/postgres/$(basename "$artifact")" --only-show-errors
  aws --endpoint-url "$R2_ENDPOINT" s3api head-object --bucket "$R2_BACKUP_BUCKET" --key "postgres/$(basename "$artifact")" >/dev/null
done

cutoff="$(date -u -d "${REMOTE_RETENTION_DAYS} days ago" +%s)"
aws --endpoint-url "$R2_ENDPOINT" s3api list-objects-v2 --bucket "$R2_BACKUP_BUCKET" --prefix postgres/ --output json \
  | jq -r '.Contents[]? | [.Key,.LastModified] | @tsv' \
  | while IFS=$'\t' read -r key modified; do
      [[ -n "$key" && -n "$modified" ]] || continue
      if (( $(date -u -d "$modified" +%s) < cutoff )); then
        aws --endpoint-url "$R2_ENDPOINT" s3api delete-object --bucket "$R2_BACKUP_BUCKET" --key "$key" >/dev/null
      fi
    done

printf '%s\n' "$(date -u +%FT%TZ) $(basename "$target") $sha256 key=$BACKUP_KEY_VERSION" > "$BACKUP_DIR/LAST_SUCCESS"
find "$BACKUP_DIR" -type f \( -name 'jalwa-postgres-*.dump.age' -o -name 'jalwa-postgres-*.dump.age.sha256' -o -name 'jalwa-postgres-*.dump.age.json' \) -mtime "+${LOCAL_RETENTION_DAYS}" -delete
trap - ERR EXIT
printf 'Created, encrypted, verified and uploaded %s (%s bytes, key %s)\n' "$target" "$size_bytes" "$BACKUP_KEY_VERSION"
