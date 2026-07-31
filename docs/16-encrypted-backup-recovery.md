# Encrypted backup recovery

Jalwa PostgreSQL dumps are encrypted and authenticated before they leave the production host. The unencrypted dump exists only as a restricted temporary file while `pg_dump` and `pg_restore --list` validate it, and is deleted immediately after encryption.

## Cryptographic format

- format identifier: `JALWA-BACKUP-V1`
- master key: 32 random bytes, stored as base64 in the production `BACKUP_ENCRYPTION_KEY` secret
- encryption: AES-256-CBC with a unique random 128-bit IV per backup
- authentication: HMAC-SHA256 over the format identifier, key version, IV and ciphertext
- subkeys: independent encryption and authentication keys derived from the master key with distinct HMAC labels
- integrity metadata: plaintext and ciphertext SHA-256 hashes and sizes

Authentication is verified before decryption. A wrong key, wrong key version, modified metadata or modified ciphertext fails without leaving plaintext output.

## Key isolation

The recovery key is not stored in the application environment. Run the `Provision production backup key` workflow after the production host exists and before the first deployment. It writes `/opt/jalwa/.env.backup` as owner `jalwa` with mode `0600`. Normal deployments do not overwrite this file.

Store an offline copy of every recovery key version in the approved organizational secret vault. Losing an old key makes backups written with that version unrecoverable.

## Rotation

1. Confirm the latest backup and restore drill succeed with the current key.
2. Archive the current key and version in the offline recovery vault.
3. Generate 32 random bytes and store their base64 value as the new `BACKUP_ENCRYPTION_KEY` GitHub environment secret.
4. Increment `BACKUP_ENCRYPTION_KEY_VERSION` in production environment variables.
5. Run `Provision production backup key`.
6. Run a backup and restore drill immediately.
7. Retain old keys until every backup encrypted with them has expired under retention policy.

## Recovery evidence

A successful backup uploads only `.dump.enc` and `.dump.enc.json` artifacts. The restore drill authenticates, decrypts, restores into an isolated temporary database, verifies required schemas and removes plaintext material before recording `LAST_RESTORE_DRILL`.
