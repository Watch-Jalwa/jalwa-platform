#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  echo "Usage: $0 encrypt INPUT OUTPUT METADATA | decrypt INPUT METADATA OUTPUT" >&2
  exit 64
}

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required as base64-encoded 32-byte key material}"
: "${BACKUP_ENCRYPTION_KEY_VERSION:?BACKUP_ENCRYPTION_KEY_VERSION is required}"
[[ "$BACKUP_ENCRYPTION_KEY_VERSION" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || {
  echo "BACKUP_ENCRYPTION_KEY_VERSION contains invalid characters." >&2
  exit 1
}

work_dir="$(mktemp -d)"
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT

key_file="$work_dir/master.key"
printf '%s' "$BACKUP_ENCRYPTION_KEY" | base64 --decode > "$key_file" 2>/dev/null || {
  echo "BACKUP_ENCRYPTION_KEY is not valid base64." >&2
  exit 1
}
[[ "$(stat -c %s "$key_file")" == "32" ]] || {
  echo "BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes." >&2
  exit 1
}
master_hex="$(od -An -v -tx1 "$key_file" | tr -d '[:space:]')"

hmac_hex() {
  local label="$1"
  printf '%s' "$label" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$master_hex" | awk '{print $NF}'
}

enc_key_hex="$(hmac_hex 'jalwa-backup-encryption-key-v1')"
mac_key_hex="$(hmac_hex 'jalwa-backup-authentication-key-v1')"
[[ "$enc_key_hex" =~ ^[0-9a-f]{64}$ && "$mac_key_hex" =~ ^[0-9a-f]{64}$ ]] || {
  echo "Failed to derive backup encryption keys." >&2
  exit 1
}

calculate_hmac() {
  local encrypted_file="$1"
  local key_version="$2"
  local iv_hex="$3"
  {
    printf 'JALWA-BACKUP-V1\n%s\n%s\n' "$key_version" "$iv_hex"
    cat "$encrypted_file"
  } | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$mac_key_hex" | awk '{print $NF}'
}

command="${1:-}"
case "$command" in
  encrypt)
    [[ $# == 4 ]] || usage
    input="$2"
    output="$3"
    metadata="$4"
    [[ -s "$input" ]] || { echo "Backup plaintext is missing or empty: $input" >&2; exit 1; }
    [[ "$input" != "$output" && "$output" != "$metadata" ]] || { echo "Backup paths must be distinct." >&2; exit 1; }

    output_dir="$(dirname "$output")"
    metadata_dir="$(dirname "$metadata")"
    mkdir -p "$output_dir" "$metadata_dir"
    output_tmp="$(mktemp "$output_dir/.jalwa-backup-encrypted.XXXXXX")"
    metadata_tmp="$(mktemp "$metadata_dir/.jalwa-backup-metadata.XXXXXX")"
    cleanup_encrypt() { rm -f "$output_tmp" "$metadata_tmp"; }
    trap 'cleanup_encrypt; cleanup' EXIT

    iv_hex="$(openssl rand -hex 16)"
    [[ "$iv_hex" =~ ^[0-9a-f]{32}$ ]] || { echo "Failed to generate backup IV." >&2; exit 1; }
    plaintext_sha256="$(sha256sum "$input" | awk '{print $1}')"
    plaintext_size="$(stat -c %s "$input")"

    openssl enc -aes-256-cbc -K "$enc_key_hex" -iv "$iv_hex" -in "$input" -out "$output_tmp"
    [[ -s "$output_tmp" ]] || { echo "Encrypted backup is empty." >&2; exit 1; }

    ciphertext_sha256="$(sha256sum "$output_tmp" | awk '{print $1}')"
    ciphertext_size="$(stat -c %s "$output_tmp")"
    authentication_hmac="$(calculate_hmac "$output_tmp" "$BACKUP_ENCRYPTION_KEY_VERSION" "$iv_hex")"
    [[ "$authentication_hmac" =~ ^[0-9a-f]{64}$ ]] || { echo "Failed to authenticate encrypted backup." >&2; exit 1; }

    jq -nc \
      --arg formatVersion "JALWA-BACKUP-V1" \
      --arg algorithm "AES-256-CBC" \
      --arg authentication "HMAC-SHA256" \
      --arg keyVersion "$BACKUP_ENCRYPTION_KEY_VERSION" \
      --arg ivHex "$iv_hex" \
      --arg hmacSha256 "$authentication_hmac" \
      --arg plaintextSha256 "$plaintext_sha256" \
      --arg ciphertextSha256 "$ciphertext_sha256" \
      --argjson plaintextSizeBytes "$plaintext_size" \
      --argjson ciphertextSizeBytes "$ciphertext_size" \
      '{formatVersion:$formatVersion,encryption:{algorithm:$algorithm,authentication:$authentication,keyVersion:$keyVersion,ivHex:$ivHex,hmacSha256:$hmacSha256},integrity:{plaintextSha256:$plaintextSha256,ciphertextSha256:$ciphertextSha256},size:{plaintextBytes:$plaintextSizeBytes,ciphertextBytes:$ciphertextSizeBytes}}' \
      > "$metadata_tmp"

    mv -f "$output_tmp" "$output"
    mv -f "$metadata_tmp" "$metadata"
    chmod 600 "$output" "$metadata"
    trap cleanup EXIT
    ;;

  decrypt)
    [[ $# == 4 ]] || usage
    input="$2"
    metadata="$3"
    output="$4"
    [[ -s "$input" && -s "$metadata" ]] || { echo "Encrypted backup or metadata is missing." >&2; exit 1; }

    format_version="$(jq -er '.formatVersion' "$metadata")"
    key_version="$(jq -er '.encryption.keyVersion' "$metadata")"
    iv_hex="$(jq -er '.encryption.ivHex' "$metadata")"
    expected_hmac="$(jq -er '.encryption.hmacSha256' "$metadata")"
    expected_plaintext_sha="$(jq -er '.integrity.plaintextSha256' "$metadata")"
    expected_ciphertext_sha="$(jq -er '.integrity.ciphertextSha256' "$metadata")"
    expected_plaintext_size="$(jq -er '.size.plaintextBytes' "$metadata")"

    [[ "$format_version" == "JALWA-BACKUP-V1" ]] || { echo "Unsupported backup format: $format_version" >&2; exit 1; }
    [[ "$key_version" == "$BACKUP_ENCRYPTION_KEY_VERSION" ]] || {
      echo "Backup requires key version '$key_version', not '$BACKUP_ENCRYPTION_KEY_VERSION'." >&2
      exit 1
    }
    [[ "$iv_hex" =~ ^[0-9a-f]{32}$ && "$expected_hmac" =~ ^[0-9a-f]{64}$ ]] || {
      echo "Backup encryption metadata is malformed." >&2
      exit 1
    }

    actual_ciphertext_sha="$(sha256sum "$input" | awk '{print $1}')"
    [[ "$actual_ciphertext_sha" == "$expected_ciphertext_sha" ]] || {
      echo "Encrypted backup checksum mismatch." >&2
      exit 1
    }
    actual_hmac="$(calculate_hmac "$input" "$key_version" "$iv_hex")"
    [[ "$actual_hmac" == "$expected_hmac" ]] || {
      echo "Encrypted backup authentication failed." >&2
      exit 1
    }

    output_dir="$(dirname "$output")"
    mkdir -p "$output_dir"
    output_tmp="$(mktemp "$output_dir/.jalwa-backup-plaintext.XXXXXX")"
    cleanup_decrypt() { rm -f "$output_tmp"; }
    trap 'cleanup_decrypt; cleanup' EXIT

    openssl enc -d -aes-256-cbc -K "$enc_key_hex" -iv "$iv_hex" -in "$input" -out "$output_tmp"
    [[ "$(sha256sum "$output_tmp" | awk '{print $1}')" == "$expected_plaintext_sha" ]] || {
      echo "Decrypted backup checksum mismatch." >&2
      exit 1
    }
    [[ "$(stat -c %s "$output_tmp")" == "$expected_plaintext_size" ]] || {
      echo "Decrypted backup size mismatch." >&2
      exit 1
    }

    mv -f "$output_tmp" "$output"
    chmod 600 "$output"
    trap cleanup EXIT
    ;;

  *) usage ;;
esac
