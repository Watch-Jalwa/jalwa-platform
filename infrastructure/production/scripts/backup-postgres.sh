#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/opt/jalwa/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/jalwa/backups/postgres}"
LOCAL_RETENTION_DAYS="${BACKUP_LOCAL_RETENTION_DAYS:-14}"
REMOTE_RETENTION_DAYS="${BACKUP_REMOTE_RETENTION_DAYS:-35}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
R2_BACKUP_BUCKET="${R2_BACKUP_BUCKET:-jalwa-backups}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_ENCRYPTION_KEY_VERSION:?BACKUP_ENCRYPTION_KEY_VERSION is required}"

mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo "A PostgreSQL backup is already running." >&2; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
created_at="$(date -u +%FT%TZ)"
reason="$(printf '%s' "${BACKUP_REASON:-scheduled}" | tr -cs 'a-zA-Z0-9._-' '-' | cut -c1-40)"
base="${BACKUP_DIR}/jalwa-postgres-${timestamp}-${reason}"
plaintext="${base}.dump.plain"
encrypted="${base}.dump.enc"
metadata="${encrypted}.json"
crypto_metadata="${metadata}.crypto"
cleanup_plaintext() { rm -f "$plaintext" "$crypto_metadata"; }
cleanup_failed() { cleanup_plaintext; rm -f "$encrypted" "$metadata"; }
trap cleanup_failed ERR
trap cleanup_plaintext EXIT

docker exec "$DB_CONTAINER" pg_isready -U postgres -d postgres >/dev/null
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --format=custom --compress=6 --no-owner --no-acl > "$plaintext"
test -s "$plaintext"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$plaintext" >/dev/null

bash "$SCRIPT_DIR/backup-crypto.sh" encrypt "$plaintext" "$encrypted" "$crypto_metadata"
rm -f "$plaintext"

jq -s \
  --arg createdAt "$created_at" \
  --arg reason "$reason" \
  '.[0] + {createdAt:$createdAt,reason:$reason,database:"postgres",format:"pg_dump_custom_encrypted"}' \
  "$crypto_metadata" > "$metadata"
rm -f "$crypto_metadata"
chmod 600 "$encrypted" "$metadata"

ciphertext_sha256="$(jq -er '.integrity.ciphertextSha256' "$metadata")"
ciphertext_size="$(jq -er '.size.ciphertextBytes' "$metadata")"
key_version="$(jq -er '.encryption.keyVersion' "$metadata")"
[[ "$(sha256sum "$encrypted" | awk '{print $1}')" == "$ciphertext_sha256" ]] || {
  echo "Encrypted backup verification failed before upload." >&2
  exit 1
}

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
for artifact in "$encrypted" "$metadata"; do
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

printf '%s\n' "$created_at $(basename "$encrypted") $ciphertext_sha256 key=$key_version" > "$BACKUP_DIR/LAST_SUCCESS"
find "$BACKUP_DIR" -type f \( -name 'jalwa-postgres-*.dump.enc' -o -name 'jalwa-postgres-*.dump.enc.json' \) -mtime "+${LOCAL_RETENTION_DAYS}" -delete
if find "$BACKUP_DIR" -maxdepth 1 -type f -name 'jalwa-postgres-*.dump.plain' -print -quit | grep -q .; then
  echo "Plaintext backup material remains after encryption." >&2
  exit 1
fi

trap - ERR
printf 'Created, authenticated and uploaded %s (%s bytes, key %s)\n' "$encrypted" "$ciphertext_size" "$key_version"
