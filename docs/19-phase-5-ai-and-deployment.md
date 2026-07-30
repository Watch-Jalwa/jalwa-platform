# Phase 5 — AI and Production Deployment

## Ask Jalwa

Implemented:

- authenticated AI requests;
- free and premium daily quotas;
- OpenAI moderation;
- catalogue-grounded retrieval;
- Urdu, Roman Urdu and English responses;
- numbered Jalwa citations;
- conversation, message and token-usage records;
- plain-text rendering to avoid unsafe generated HTML;
- conservative instructions for farming, health, religion, law and finance.

Required runtime values:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_FREE_DAILY_LIMIT`
- `AI_PREMIUM_DAILY_LIMIT`

## Production topology

- Ubuntu VPS with Docker Engine and Docker Compose;
- Caddy reverse proxy and TLS;
- Jalwa web image from GHCR;
- Jalwa FFmpeg worker image from GHCR;
- managed Supabase/PostgreSQL;
- Cloudflare R2;
- Cloudflare Worker media gateway;
- hosted payment provider.

## GitHub production environment secrets

Add these under **Settings → Environments → production**:

### Build and application

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Cloudflare

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MEDIA_SIGNING_SECRET`

### VPS deployment

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_KEY`
- `GHCR_USERNAME`
- `GHCR_DEPLOY_TOKEN` with package-read access

The remaining application secrets belong only in `/opt/jalwa/.env.production` on the server. Start from `infrastructure/production/.env.production.example`.

## Server bootstrap

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"
sudo mkdir -p /opt/jalwa
sudo chown -R "$USER:$USER" /opt/jalwa
```

Copy the completed production environment file to:

```text
/opt/jalwa/.env.production
```

Do not commit it.

## DNS

Create Cloudflare DNS records for:

- `watch-jalwa.com`
- `www.watch-jalwa.com`

Both should resolve to the production server. Configure the media gateway domain or Workers route and place its HTTPS URL in `NEXT_PUBLIC_MEDIA_GATEWAY_URL`.

## Database

Apply all Supabase migrations in order, including:

- platform foundation;
- catalogue and rights;
- media pipeline;
- payments and entitlements;
- AI conversations and quotas.

## Deployment

Run the GitHub workflow:

```text
Actions → Deploy production → Run workflow
```

It will:

1. build web and worker images;
2. publish them to GHCR;
3. deploy the Cloudflare media gateway;
4. copy Caddy and Compose configuration to the VPS;
5. restart Jalwa;
6. verify `https://watch-jalwa.com/api/health`.

## Launch blockers outside the repository

- production server access;
- Supabase project and migrated database;
- Cloudflare account, R2 buckets and DNS;
- OpenAI API project and spend limit;
- approved payment merchant account and production credentials;
- legal pages and Pakistan counsel review;
- approved launch catalogue and rights evidence.
