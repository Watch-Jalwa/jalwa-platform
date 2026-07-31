#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup="$root/infrastructure/production/scripts/backup-postgres.sh"
restore="$root/infrastructure/production/scripts/restore-drill.sh"
crypto="$root/infrastructure/production/scripts/backup-crypto.sh"
workflow="$root/.github/workflows/provision-backup-key.yml"
application_env="$root/infrastructure/production/.env.production.example"
backup_env="$root/infrastructure/production/.env.backup.example"

fail() { echo "FAIL $*" >&2; exit 1; }
require() { grep -Fq -- "$1" "$2" || fail "$3"; }
reject() { ! grep -Fq -- "$1" "$2" || fail "$3"; }

for script in "$backup" "$restore" "$crypto"; do bash -n "$script"; done

require 'JALWA-BACKUP-V1' "$crypto" 'versioned encrypted backup format is missing'
require 'AES-256-CBC' "$crypto" 'AES-256 encryption metadata is missing'
require 'HMAC-SHA256' "$crypto" 'authenticated backup metadata is missing'
require 'calculate_hmac' "$crypto" 'ciphertext authentication is missing'
require '.dump.enc' "$backup" 'backup output is not encrypted'
require 'rm -f "$plaintext"' "$backup" 'plaintext backup is not removed before upload'
require 's3 cp "$artifact"' "$backup" 'encrypted backup upload is missing'
reject 's3 cp "$plaintext"' "$backup" 'plaintext backup could be uploaded'
require 'backup-crypto.sh" decrypt' "$restore" 'restore drill does not decrypt authenticated backups'
require 'BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/opt/jalwa/.env.backup}"' "$backup" 'backup key is not isolated from app environment'
require 'BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/opt/jalwa/.env.backup}"' "$restore" 'restore key is not isolated from app environment'
require 'install -o jalwa -g jalwa -m 0600' "$workflow" 'recovery key file permissions are not enforced'
require 'BACKUP_ENCRYPTION_KEY=' "$backup_env" 'isolated recovery environment example is missing'
reject 'BACKUP_ENCRYPTION_KEY=' "$application_env" 'recovery key leaked into application environment example'

printf 'Production encrypted-backup policy tests passed.\n'
