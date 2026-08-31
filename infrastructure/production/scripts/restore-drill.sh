#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/opt/jalwa/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/jalwa/backups/postgres}"
DB_CONTAINER="${DB_CONTAINER:-jalwa-postgres}"
R2_BACKUP_BUCKET="${R2_BACKUP_BUCKET:-jalwa-backups}"
BACKUP_AGE_IDENTITY_FILE="${BACKUP_AGE_IDENTITY_FILE:-/opt/jalwa/secrets/backup-age.key}"

if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

[[ -r "$BACKUP_AGE_IDENTITY_FILE" ]] || { echo "Backup age identity is not readable." >&2; exit 1; }
command -v age >/dev/null || { echo "age is required for backup decryption." >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.restore-drill.lock"
flock -n 9 || { echo "A restore drill is already running." >&2; exit 1; }

latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'jalwa-postgres-*.dump.age' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
if [[ -z "$latest" ]]; then
  : "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
  : "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
  : "${R2_ENDPOINT:?R2_ENDPOINT is required}"
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  key="$(aws --endpoint-url "$R2_ENDPOINT" s3api list-objects-v2 --bucket "$R2_BACKUP_BUCKET" --prefix postgres/ --output json \
    | jq -r '[.Contents[]? | select(.Key | endswith(".dump.age"))] | sort_by(.LastModified) | last | .Key // empty')"
  [[ -n "$key" ]] || { echo "No encrypted PostgreSQL backup is available for a restore drill." >&2; exit 1; }
  latest="$BACKUP_DIR/$(basename "$key")"
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "s3://${R2_BACKUP_BUCKET}/${key}" "$latest" --only-show-errors
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "s3://${R2_BACKUP_BUCKET}/${key}.sha256" "$latest.sha256" --only-show-errors
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "s3://${R2_BACKUP_BUCKET}/${key}.json" "$latest.json" --only-show-errors
fi

[[ -s "$latest" && -s "$latest.sha256" && -s "$latest.json" ]] || { echo "Encrypted backup, checksum or metadata is missing." >&2; exit 1; }
expected="$(cut -d' ' -f1 "$latest.sha256")"
actual="$(sha256sum "$latest" | cut -d' ' -f1)"
[[ "$expected" == "$actual" ]] || { echo "Encrypted backup checksum mismatch." >&2; exit 1; }
jq -e '.format == "age+pg_dump_custom" and .encryption.scheme == "age-x25519" and (.encryption.keyVersion | length > 0)' "$latest.json" >/dev/null

plaintext="$(mktemp "$BACKUP_DIR/restore-drill.XXXXXX.dump")"
drill_db="jalwa_restore_drill_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  rm -f "$plaintext"
  docker exec "$DB_CONTAINER" dropdb -U postgres --if-exists "$drill_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" --output "$plaintext" "$latest"
test -s "$plaintext"
plaintext_expected="$(jq -r '.plaintextSha256' "$latest.json")"
plaintext_actual="$(sha256sum "$plaintext" | cut -d' ' -f1)"
[[ "$plaintext_expected" == "$plaintext_actual" ]] || { echo "Decrypted backup checksum mismatch." >&2; exit 1; }
docker exec -i "$DB_CONTAINER" pg_restore --list < "$plaintext" >/dev/null

docker exec "$DB_CONTAINER" createdb -U postgres -T template0 "$drill_db"
docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d "$drill_db" --exit-on-error --no-owner --no-acl < "$plaintext"
verification="$(docker exec "$DB_CONTAINER" psql -U postgres -d "$drill_db" -Atqc "select (to_regclass('public.profiles') is not null and to_regclass('public.content_items') is not null and to_regclass('auth.users') is not null)::text")"
[[ "$verification" == "true" ]] || { echo "Restore drill schema verification failed." >&2; exit 1; }
key_version="$(jq -r '.encryption.keyVersion' "$latest.json")"
printf '%s\n' "$(date -u +%FT%TZ) $(basename "$latest") $actual key=$key_version" > "$BACKUP_DIR/LAST_RESTORE_DRILL"
echo "Restore drill succeeded using $(basename "$latest") with key $key_version"
