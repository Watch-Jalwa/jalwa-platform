# Encrypted PostgreSQL backups

Production PostgreSQL backups are encrypted on the host before they are uploaded to R2. The remote object is an age-encrypted custom-format PostgreSQL dump. Plaintext exists only in a mode-`0600` temporary file while `pg_dump` output is verified and encrypted, and is removed before upload.

## Key provisioning

Before the first deployment:

1. Generate an age X25519 identity on a secured administrator machine with `age-keygen`.
2. Store the identity in an offline recovery system and a separately protected password manager or secrets vault.
3. Install the production copy at `/opt/jalwa/secrets/backup-age.key`, owned by `jalwa`, mode `0600`.
4. The backup and restore scripts use that path by default. `BACKUP_AGE_IDENTITY_FILE` may override it.
5. The public recipient is derived from the identity by default. `BACKUP_AGE_RECIPIENT` may override it.
6. Set `BACKUP_KEY_VERSION` to a stable identifier such as `2026-01`; it defaults to `v1`.

The private identity must never be committed, placed in R2, included in deployment artifacts or written to application logs.

## Rotation

Generate a new identity, increment `BACKUP_KEY_VERSION`, install the new private identity and update the recipient. Retain every historical private identity for at least as long as backups encrypted to it remain within retention. Metadata records the key version used for each object.

## Restore evidence

The restore drill verifies the encrypted-object checksum, validates encryption metadata, decrypts to a protected temporary file, verifies the plaintext checksum, runs `pg_restore --list`, restores into an isolated temporary database and verifies core schemas. The plaintext and drill database are removed on exit.

CI proves that the configured key can decrypt an encrypted artifact and that an unrelated age identity cannot produce plaintext.
