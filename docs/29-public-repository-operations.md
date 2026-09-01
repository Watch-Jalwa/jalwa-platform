# Public repository operational boundary

The `jalwa-platform` repository may be public, but repository visibility does not change Jalwa's deployment, credential or release-safety boundaries.

- Never commit secrets, private keys, access tokens, payment credentials, database passwords, SMTP credentials or provider credentials.
- Protected GitHub environments remain the only supported location for staging/production workflow secrets and sensitive environment values.
- Public repository visibility does not authorize production deployment, live payments, catalogue activation, AI activation or visual-baseline approval.
- Staging still requires an exact green `main` SHA, immutable deployment artifacts and the permanent certification decision defined in `docs/27-staging-certification.md`.
- Owner-controlled external credentials and generated-secret boundaries remain defined in `docs/28-self-hosted-staging-environment.md`.
- Any accidental secret exposure must be treated as compromised immediately: rotate the credential, remove it from active configuration, review audit logs and follow the private security process in `SECURITY.md`.

Repository visibility is therefore an access/distribution setting only; it must never be used to weaken runtime, environment, payment, rights or release controls.
