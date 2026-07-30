# Self-hosted production readiness

## Decision

Jalwa no longer requires a paid managed Supabase project. Production uses the official Supabase Docker distribution on the DigitalOcean host. This preserves the existing PostgreSQL schema, Row Level Security, Auth, PostgREST and `supabase-js` integration without a backend rewrite.

The upstream Supabase Docker source is not copied blindly from a moving branch. `SUPABASE_DOCKER_REF` must be an immutable 40-character commit SHA reviewed by DevOps before deployment.

## Production topology

```text
Cloudflare
├── watch-jalwa.com → Caddy → Jalwa web
├── api.watch-jalwa.com → Caddy → Supabase Kong allow-listed APIs
├── media.watch-jalwa.com → Cloudflare Worker → R2
└── R2 buckets → media, incoming files, rights evidence, backups

DigitalOcean
├── Jalwa web
├── FFmpeg worker
├── Caddy
└── official self-hosted Supabase
    ├── PostgreSQL
    ├── Auth
    ├── PostgREST
    ├── Supavisor
    ├── Realtime
    └── Studio through SSH tunnel only
```

## Security controls

- Only ports 80 and 443 are public; SSH is restricted to the approved CIDR.
- PostgreSQL, Supavisor and Kong host ports are blocked by the cloud firewall.
- Caddy exposes only Supabase Auth, REST, Realtime, Storage, Functions and JWKS paths.
- Studio is not published on a public hostname.
- Upstream Docker configuration is pinned to a reviewed commit.
- Default Supabase passwords and JWTs are never used.
- Application containers drop Linux capabilities and use `no-new-privileges`.
- The web container is read-only except for a bounded temporary filesystem.
- Docker logs rotate.
- Production cannot use mock payments.
- Auth methods are hidden unless their provider is enabled.
- Premium is activated only by a verified webhook.

## Database lifecycle

`apply-migrations.sh` records every migration filename and SHA-256 checksum. It skips an unchanged migration and fails if an already-applied file was edited. New schema changes must always be added as a new migration.

`backup-postgres.sh` creates a custom-format PostgreSQL dump, writes a checksum, uploads both to the private `jalwa-backups` R2 bucket and keeps a short local retention window. A systemd timer runs daily. `restore-postgres.sh` requires an explicit destructive confirmation and checksum validation.

A restore drill must be completed before launch and quarterly thereafter.

## Auth

Production email login requires a real SMTP account. Phone OTP and Google, Apple or Facebook login are feature-flagged and remain invisible until their credentials are present. The self-hosted Auth configuration is generated from GitHub Environment Secrets.

## GitHub production variables

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_DOMAIN`
- `SUPABASE_DOCKER_REF`
- `PAYMENT_PROVIDER`
- `SMTP_PORT`
- `ENABLE_PHONE_AUTH`
- `ENABLE_GOOGLE_AUTH`
- `ENABLE_APPLE_AUTH`
- `ENABLE_FACEBOOK_AUTH`

## GitHub production secrets

Run `node scripts/generate-supabase-secrets.mjs` once on a trusted machine and add its output as separate GitHub Environment Secrets. Do not paste the output into chat or commit it.

Core self-hosted database secrets:

- `SELF_HOSTED_POSTGRES_PASSWORD`
- `SELF_HOSTED_SUPABASE_JWT_SECRET`
- `SELF_HOSTED_SUPABASE_ANON_KEY`
- `SELF_HOSTED_SUPABASE_SERVICE_ROLE_KEY`
- `SELF_HOSTED_SUPABASE_DASHBOARD_PASSWORD`
- `SELF_HOSTED_SUPABASE_SECRET_KEY_BASE`
- `SELF_HOSTED_SUPABASE_VAULT_ENC_KEY`
- `SELF_HOSTED_SUPABASE_PG_META_CRYPTO_KEY`
- `SELF_HOSTED_SUPABASE_LOGFLARE_PUBLIC_TOKEN`
- `SELF_HOSTED_SUPABASE_LOGFLARE_PRIVATE_TOKEN`
- `SELF_HOSTED_SUPABASE_POOLER_TENANT_ID`

Also add deployment, R2, SMTP, DeepSeek, media-signing and selected payment-provider credentials. Optional SMS and OAuth credentials are required only when their flags are enabled.

## Pre-launch acceptance

Before public traffic is enabled:

1. Bootstrap and deploy workflows pass.
2. `/api/health`, `/api/readiness` and Supabase Auth health return 200.
3. Signup email arrives and callback completes.
4. RLS tests pass against the deployed database.
5. A real sandbox payment activates an entitlement only through its webhook.
6. Public and Premium playback succeed on low-end Android and desktop browsers.
7. A PostgreSQL backup uploads to R2.
8. A backup is restored to an isolated host and checksums match.
9. Rights-approved launch content is imported.
10. Legal, security, accessibility and incident-response reviews are signed off.

The repository is deployment-ready; merchant approval, credentials, licensed content and the actual infrastructure run remain external launch inputs.
