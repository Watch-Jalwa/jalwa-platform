#!/usr/bin/env bash
set -Eeuo pipefail

command -v age >/dev/null || { echo "age is required" >&2; exit 1; }
command -v age-keygen >/dev/null || { echo "age-keygen is required" >&2; exit 1; }

temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT

age-keygen -o "$temporary_directory/correct.key" >/dev/null 2>&1
age-keygen -o "$temporary_directory/wrong.key" >/dev/null 2>&1
recipient="$(age-keygen -y "$temporary_directory/correct.key")"
printf 'Jalwa encrypted backup contract\n' > "$temporary_directory/plaintext.dump"
age --encrypt --recipient "$recipient" --output "$temporary_directory/backup.dump.age" "$temporary_directory/plaintext.dump"
rm -f "$temporary_directory/plaintext.dump"
age --decrypt --identity "$temporary_directory/correct.key" --output "$temporary_directory/restored.dump" "$temporary_directory/backup.dump.age"
grep -Fx 'Jalwa encrypted backup contract' "$temporary_directory/restored.dump" >/dev/null

set +e
age --decrypt --identity "$temporary_directory/wrong.key" --output "$temporary_directory/wrong.dump" "$temporary_directory/backup.dump.age" >/dev/null 2>&1
wrong_status=$?
set -e
[[ "$wrong_status" -ne 0 ]] || { echo "Encrypted backup was decrypted with an unrelated key." >&2; exit 1; }
[[ ! -s "$temporary_directory/wrong.dump" ]] || { echo "Wrong-key decryption produced plaintext." >&2; exit 1; }

backup_script="infrastructure/production/scripts/backup-postgres.sh"
restore_script="infrastructure/production/scripts/restore-drill.sh"
grep -Fq 'BACKUP_AGE_RECIPIENT' "$backup_script"
grep -Fq '.dump.age' "$backup_script"
grep -Fq 'rm -f "$plaintext"' "$backup_script"
grep -Fq 'BACKUP_AGE_IDENTITY_FILE' "$restore_script"
grep -Fq 'plaintextSha256' "$restore_script"
printf 'Encrypted backup contract tests passed.\n'
