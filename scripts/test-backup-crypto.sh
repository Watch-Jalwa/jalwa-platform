#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
crypto="$repository_root/infrastructure/production/scripts/backup-crypto.sh"
work_dir="$(mktemp -d)"
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT

fail() { echo "FAIL $*" >&2; exit 1; }

plaintext="$work_dir/source.dump"
encrypted="$work_dir/source.dump.enc"
metadata="$encrypted.json"
restored="$work_dir/restored.dump"
wrong_output="$work_dir/wrong.dump"
tampered="$work_dir/tampered.dump.enc"
tampered_output="$work_dir/tampered.dump"

{
  printf 'Jalwa encrypted backup regression fixture\n'
  openssl rand 8192
} > "$plaintext"

export BACKUP_ENCRYPTION_KEY="$(openssl rand 32 | base64 -w0)"
export BACKUP_ENCRYPTION_KEY_VERSION="test-key-v1"

bash "$crypto" encrypt "$plaintext" "$encrypted" "$metadata"
[[ -s "$encrypted" && -s "$metadata" ]] || fail "encryption did not create artifacts"
[[ "$(sha256sum "$plaintext" | awk '{print $1}')" != "$(sha256sum "$encrypted" | awk '{print $1}')" ]] || fail "ciphertext matches plaintext"
jq -e '.formatVersion == "JALWA-BACKUP-V1" and .encryption.algorithm == "AES-256-CBC" and .encryption.authentication == "HMAC-SHA256" and .encryption.keyVersion == "test-key-v1"' "$metadata" >/dev/null || fail "encryption metadata is incomplete"

bash "$crypto" decrypt "$encrypted" "$metadata" "$restored"
cmp -s "$plaintext" "$restored" || fail "decrypted backup does not match source"
printf 'PASS encrypted backup round trip\n'

original_key="$BACKUP_ENCRYPTION_KEY"
BACKUP_ENCRYPTION_KEY="$(openssl rand 32 | base64 -w0)"
export BACKUP_ENCRYPTION_KEY
set +e
bash "$crypto" decrypt "$encrypted" "$metadata" "$wrong_output" >/dev/null 2>&1
wrong_status=$?
set -e
[[ "$wrong_status" -ne 0 ]] || fail "wrong key unexpectedly decrypted backup"
[[ ! -e "$wrong_output" ]] || fail "wrong key left plaintext output"
printf 'PASS wrong recovery key is rejected\n'

BACKUP_ENCRYPTION_KEY="$original_key"
export BACKUP_ENCRYPTION_KEY
cp "$encrypted" "$tampered"
printf '\001' | dd of="$tampered" bs=1 seek=32 conv=notrunc status=none
set +e
bash "$crypto" decrypt "$tampered" "$metadata" "$tampered_output" >/dev/null 2>&1
tampered_status=$?
set -e
[[ "$tampered_status" -ne 0 ]] || fail "tampered ciphertext unexpectedly decrypted"
[[ ! -e "$tampered_output" ]] || fail "tampered ciphertext left plaintext output"
printf 'PASS ciphertext tampering is rejected\n'

BACKUP_ENCRYPTION_KEY="$(openssl rand 16 | base64 -w0)"
export BACKUP_ENCRYPTION_KEY
set +e
bash "$crypto" encrypt "$plaintext" "$work_dir/invalid.enc" "$work_dir/invalid.json" >/dev/null 2>&1
short_key_status=$?
set -e
[[ "$short_key_status" -ne 0 ]] || fail "short encryption key was accepted"
printf 'PASS invalid key material is rejected\n'

echo "Backup encryption tests passed."
