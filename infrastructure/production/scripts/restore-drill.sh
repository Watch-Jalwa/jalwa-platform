#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/opt/jalwa/.env.production}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/opt/jalwa/.env.backup}"
BACKUP_DIR="${BACKUP_DIR:-/opt/jalwa/backups/postgres}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
R2_BACKUP_BUCKET="${R2_BACKUP_BUCKET:-jalwa-backups}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for environment_file in "$ENV_FILE" "$BACKUP_ENV_FILE"; do
  if [[ -r "$environment_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$environment_file"
    set +a
  fi
done

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required in $BACKUP_ENV_FILE}"
: "${BACKUP_ENCRYPTION_KEY_VERSION:?BACKUP_ENCRYPTION_KEY_VERSION is required in $BACKUP_ENV_FILE}"

mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.restore-drill.lock"
flock -n 9 || { echo "A restore drill is already running." >&2; exit 1; }

latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'jalwa-postgres-*.dump.enc' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
if [[ -z "$latest" ]]; then
  : "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
  : "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
  : "${R2_ENDPOINT:?R2_ENDPOINT is required}"
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  key="$(aws --endpoint-url "$R2_ENDPOINT" s3api list-objects-v2 --bucket "$R2_BACKUP_BUCKET" --prefix postgres/ --output json \
    | jq -r '[.Contents[]? | select(.Key | endswith(".dump.enc"))] | sort_by(.LastModified) | last | .Key // empty')"
  [[ -n "$key" ]] || { echo "No encrypted PostgreSQL backup is available for a restore drill." >&2; exit 1; }
  latest="$BACKUP_DIR/$(basename "$key")"
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "s3://${R2_BACKUP_BUCKET}/${key}" "$latest" --only-show-errors
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "s3://${R2_BACKUP_BUCKET}/${key}.json" "$latest.json" --only-show-errors
fi

metadata="$latest.json"
[[ -s "$latest" && -s "$metadata" ]] || { echo "Encrypted backup or metadata is missing." >&2; exit 1; }
plaintext="$(mktemp "$BACKUP_DIR/.jalwa-restore-plaintext.XXXXXX")"
cleanup_plaintext() { rm -f "$plaintext"; }
trap cleanup_plaintext EXIT

bash "$SCRIPT_DIR/backup-crypto.sh" decrypt "$latest" "$metadata" "$plaintext"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$plaintext" >/dev/null

drill_db="jalwa_restore_drill_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  cleanup_plaintext
  docker exec "$DB_CONTAINER" dropdb -U postgres --if-exists "$drill_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec "$DB_CONTAINER" createdb -U postgres -T template0 "$drill_db"
docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d "$drill_db" --exit-on-error --no-owner --no-acl < "$plaintext"
verification="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$drill_db" -Atqc "select (to_regclass('public.profiles') is not null and to_regclass('public.content_items') is not null and to_regclass('auth.users') is not null)::text")"
[[ "$verification" == "true" ]] || { echo "Restore drill schema verification failed." >&2; exit 1; }

ciphertext_sha="$(jq -er '.integrity.ciphertextSha256' "$metadata")"
key_version="$(jq -er '.encryption.keyVersion' "$metadata")"
printf '%s\n' "$(date -u +%FT%TZ) $(basename "$latest") $ciphertext_sha key=$key_version" > "$BACKUP_DIR/LAST_RESTORE_DRILL"
echo "Restore drill succeeded using authenticated encrypted backup $(basename "$latest")"
