# On-prem staging deployment contract

Status: **active staging architecture**.

This document supersedes the DigitalOcean-specific staging provisioning steps in older operational notes. It does not change the production authorization boundary.

## Active staging target

- Public URL: `https://jalwa-platform.codistan.org`
- Host: existing Codistan-managed Linux server
- SSH/deployment account: `codistan`
- Managed application root: `/opt/codistan/jalwa-platform`
- Compose project: `jalwa-platform`
- Reverse proxy/TLS: existing host nginx
- Nginx upstream: loopback port `127.0.0.1:3001`
- Application: immutable GHCR `web` and `worker` images built from an exact Git SHA
- Database: existing self-hosted `pgvector/pgvector:pg16` container on the same server
- Database container: `jalwa-postgres-staging`
- Existing database volume: `jalwa-platform_jalwa_staging_pgdata`
- Existing Docker network: `jalwa-platform_default`
- Authentication: Better Auth directly against PostgreSQL
- Email: SMTP/Brevo-compatible provider configured in server-managed `.env.staging`
- Object storage: private Cloudflare R2 buckets for incoming media, processed media and encrypted PostgreSQL backups
- Transcoding: FFmpeg in the worker runtime
- Playback: same-origin signed `/api/media/...` gateway backed by private R2
- AI: DeepSeek staging credentials when enabled
- Payments: mock-only until separate real-provider sandbox certification

Supabase is not part of the runtime. DigitalOcean is not part of the active staging host. A Cloudflare Worker/custom `media.*` hostname is not required for the active R2 media path.

## Existing-stack adoption boundary

The Codistan server contained a manually created Jalwa staging stack before the managed workflow took ownership. The first managed deployment must therefore preserve the existing database rather than create a parallel environment.

The adoption contract is fail-closed:

- the deployment must find `jalwa-postgres-staging` under Compose project `jalwa-platform` and service `postgres`;
- the PostgreSQL data mount must be the existing volume `jalwa-platform_jalwa_staging_pgdata`;
- the Docker network `jalwa-platform_default` must already exist;
- the first managed release updates only `web` and `worker` with Compose `--no-deps`, so PostgreSQL cannot be opportunistically recreated;
- an encrypted PostgreSQL backup must succeed before migrations or application replacement;
- the base Compose plus `docker-compose.codistan-staging.yml` explicitly adopts the existing container/network/volume identities;
- PostgreSQL remains on pgvector/PostgreSQL 16 during this adoption. A major database upgrade is a separate migration with its own backup/restore plan.

## Secret ownership

Application/runtime credentials remain in `/opt/codistan/jalwa-platform/.env.staging` on the staging server. They do not need to be duplicated into GitHub merely for storage.

GitHub needs only the credentials required to deploy to the host:

- environment secret `STAGING_SSH_KEY`
- environment variable `STAGING_SSH_KNOWN_HOSTS`

Optional overrides exist for compatibility, but the active Codistan contract deliberately validates the known target identities:

- `STAGING_HOST` defaults to `jalwa-platform.codistan.org`
- `STAGING_USER` defaults to `codistan`
- `STAGING_APP_DIR` defaults to `/opt/codistan/jalwa-platform`
- `STAGING_DOMAIN` defaults to `jalwa-platform.codistan.org`

The SSH host key must be verified out of band before it is stored. Do not replace pinning with runtime `ssh-keyscan`/TOFU.

## Deployment flow

`Deploy staging` is the canonical active workflow.

1. Require `main` and a 40-character source SHA.
2. Validate the pinned SSH configuration and the Codistan deployment account/root.
3. Build web and worker images with OCI revision/build-run labels, SBOM and provenance.
4. Push immutable SHA-tagged images to GHCR.
5. Back up the previous manually maintained Compose file before installing canonical release assets.
6. Preserve the existing server-managed `.env.staging`; do not reconstruct secrets in Actions.
7. Reject legacy Supabase values and enforce `NODE_ENV=production`, Better Auth public URL, R2/FFmpeg same-origin media and mock-payment staging boundaries.
8. Validate the existing PostgreSQL container, pgdata volume and Docker network before any mutation.
9. Use `docker-compose.yml` plus `docker-compose.codistan-staging.yml`; publish web only on `127.0.0.1:3001` for nginx and do not start repository Caddy.
10. Create and upload an encrypted pre-deployment PostgreSQL backup while the existing database container is still running.
11. Apply bootstrap/migrations with the migration checksum ledger against `jalwa-postgres-staging`.
12. Deploy only the exact immutable web/worker release with `--no-deps` and rollback support.
13. Install operational timers using the Codistan root/account.
14. Create an encrypted post-deployment backup and execute a restore drill.
15. Run host/public acceptance against the same database/container identities.
16. Capture exact running image IDs, registry digests, OCI revisions and rollback reference.
17. Let `Staging certification` execute against that exact release.

## Media security and delivery

### Upload and processing

Studio uploads use short-lived signed PUT URLs into the private incoming R2 bucket. The worker downloads only the approved incoming object, probes it with bounded FFprobe settings, and processes it with the local-protocol-only FFmpeg boundary.

FFmpeg produces:

- portrait optimized MP4 for short-form jobs;
- 360p/480p/720p HLS variants plus master playlist for long-form jobs;
- a JPEG thumbnail for every local FFmpeg video job;
- HLS output that works for both videos with audio and silent videos.

Successful processing does **not** publish content. Rights/publication/availability remain separate database gates.

### Playback

For R2, the playback-token API signs a short-lived HMAC token bound to the processed asset prefix. The browser receives a same-origin `/api/media/processed/...` URL.

The media route:

- rejects paths outside `processed/` and traversal attempts;
- verifies expiry/signature and the token's allowed path prefix;
- never serves the incoming/raw bucket;
- supports byte ranges for media objects;
- streams private R2 objects without making the bucket public;
- rewrites HLS child URIs so the same short-lived token is retained;
- rejects absolute/external child URIs to avoid token leakage.

The older Cloudflare Worker media gateway remains an optional alternative architecture, not a requirement for current on-prem staging.

## Reverse proxy

The canonical base Compose still includes Caddy for deployments that choose the managed proxy model. Codistan staging applies `docker-compose.codistan-staging.yml`, which:

- maps Jalwa web to `127.0.0.1:${JALWA_WEB_PORT:-3001}:3000`;
- preserves the existing `jalwa-platform_default` network;
- preserves the existing pgdata volume;
- places Caddy behind an opt-in `managed-proxy` profile.

The existing nginx instance terminates TLS and proxies `jalwa-platform.codistan.org` to loopback port `3001`.

## Operations

The staging host must have Docker/Compose plus `jq`, `age`/`age-keygen` and AWS CLI. The deployment workflow verifies/installs the non-Docker command-line dependencies when passwordless sudo is available.

The deployment installs and verifies timers for:

- encrypted PostgreSQL backups;
- source health;
- account requests;
- maintenance;
- restore drills.

Systemd templates remain production-compatible but the installer rewrites the managed root, environment file, service user and group for the Codistan staging host.

Backups are encrypted before upload. A deployment is not accepted merely because containers are running; backup freshness, restore-drill freshness, migrations, queues, security headers, public readiness and exact release identity are all checked.

## Promotion boundary

Staging success does not authorize production. Production requires the repository certification result, human UAT, rights/media acceptance, real payment-provider sandbox evidence when commerce is enabled, retained rollback/backup evidence and a separate explicit production authorization. Production must promote the exact staging-tested immutable artifacts rather than rebuild from source.
