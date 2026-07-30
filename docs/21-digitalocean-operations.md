# DigitalOcean Deployment and Operations

## Topology

One Ubuntu Droplet runs:

- Jalwa web container;
- FFmpeg worker container;
- Caddy reverse proxy and TLS;
- the official self-hosted Supabase/PostgreSQL Docker stack.

External services remain Cloudflare DNS/R2/Workers, DeepSeek and the selected hosted payment provider.

## Provisioning

Use `infrastructure/digitalocean`. The module creates a monitored Droplet, cloud firewall, project, deployment user and host bootstrap. The recommended combined-stack minimum is 4 vCPU, 8 GB RAM and 80 GB SSD. Restrict SSH to a trusted office or VPN CIDR.

## Deployment

The production workflow:

1. validates every required secret and feature flag;
2. builds immutable web and worker images tagged with the Git commit;
3. deploys the Cloudflare media gateway to `media.<domain>`;
4. installs a pinned official Supabase Docker revision;
5. renders self-hosted Auth/PostgreSQL configuration from GitHub secrets;
6. applies checksum-tracked SQL migrations;
7. deploys Jalwa through Docker Compose and Caddy;
8. installs the daily backup timer;
9. runs application and Auth smoke tests;
10. uploads an initial database backup to R2.

## Studio access

Supabase Kong binds to `127.0.0.1:8000`. Use an SSH tunnel rather than publishing Studio:

```bash
ssh -L 8000:127.0.0.1:8000 jalwa@SERVER_IP
```

Then open `http://127.0.0.1:8000` and use the dashboard credentials stored in the GitHub production environment.

## Rollback

```bash
/opt/jalwa/scripts/rollback.sh <previous-git-sha>
```

Application rollback changes only the web and worker image tag. Database changes must use forward migrations. For a disaster restore, use the tested PostgreSQL restore procedure.

## Database backup and restore

`jalwa-backup.timer` runs a custom-format `pg_dump` daily, creates a SHA-256 checksum and uploads both files to the private `jalwa-backups` R2 bucket.

Manual backup:

```bash
/opt/jalwa/scripts/backup-postgres.sh
```

Destructive restore:

```bash
RESTORE_CONFIRM=RESTORE /opt/jalwa/scripts/restore-postgres.sh /path/to/jalwa-postgres-TIMESTAMP.dump
```

A backup is not accepted until it has been restored successfully on an isolated host.

## Monitoring

- DigitalOcean host monitoring and Droplet backups are enabled.
- Docker logs rotate.
- GitHub runs scheduled health checks.
- `/api/health` detects process availability.
- `/api/readiness` detects configuration or database failures.
- Supabase services have container health checks.
- Studio Operations shows product-level queues and counts.

## External deployment inputs

- DigitalOcean, Cloudflare and R2 credentials;
- SSH and GHCR deployment credentials;
- generated self-hosted database secrets;
- SMTP credentials;
- DeepSeek key;
- selected payment-provider credentials;
- optional SMS and OAuth credentials;
- a reviewed immutable `SUPABASE_DOCKER_REF`.
