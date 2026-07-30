# DigitalOcean Deployment and Operations

## Topology

One Ubuntu Droplet runs:

- Jalwa web container;
- FFmpeg worker container;
- Caddy reverse proxy and TLS.

External managed services remain:

- Supabase/PostgreSQL;
- Cloudflare R2 and media gateway;
- OpenAI;
- hosted payment provider.

## Provisioning

Use `infrastructure/digitalocean`. The module creates a monitored Droplet, cloud firewall, project, deployment user and host bootstrap. Choose the region in the DigitalOcean account and restrict SSH to a trusted office or VPN CIDR.

## Deployment

The production workflow now:

1. builds immutable web and worker images tagged with the Git commit;
2. pushes them to GHCR;
3. deploys the Cloudflare media gateway;
4. copies Compose, Caddy and operations scripts to `/opt/jalwa`;
5. persists the deployed image tag;
6. restarts services;
7. runs health, readiness and public-page smoke tests.

## Rollback

On the Droplet:

```bash
/opt/jalwa/scripts/rollback.sh <previous-git-sha>
```

The script preserves the current environment file, switches the image tag, restarts the stack and runs smoke tests.

## Database backup

Supabase-managed backups remain the primary database recovery mechanism. The included script can create an additional encrypted-host backup target when `DATABASE_URL` is available:

```bash
set -a
source /opt/jalwa/.env.production
set +a
/opt/jalwa/scripts/backup-postgres.sh
```

Example daily cron, after verifying backup storage and access controls:

```text
15 2 * * * set -a; . /opt/jalwa/.env.production; set +a; /opt/jalwa/scripts/backup-postgres.sh >> /var/log/jalwa-backup.log 2>&1
```

Do not treat a backup as valid until a restore has been tested in a non-production database.

## Monitoring

- DigitalOcean host monitoring is enabled.
- GitHub runs hourly health and readiness checks.
- `/api/health` detects process availability.
- `/api/readiness` detects missing configuration or database access.
- Studio Operations shows product-level queues and counts.

## Required owner inputs

- DigitalOcean API token or a manually created Droplet;
- selected region and Droplet size;
- SSH public key and trusted admin CIDR;
- DNS access;
- production service secrets.
