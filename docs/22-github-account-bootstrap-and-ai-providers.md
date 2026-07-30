# GitHub Account Bootstrap and AI Providers

## Goal

GitHub Actions is the deployment control plane. Account credentials are stored in the protected `production` environment, while generated non-secret identifiers are saved as environment variables.

## One-time account connections

Add these production environment secrets:

### DigitalOcean

- `DIGITALOCEAN_TOKEN`
- `DIGITALOCEAN_SSH_PUBLIC_KEY`
- `PRODUCTION_SSH_KEY`

### Cloudflare

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `MEDIA_SIGNING_SECRET`

### Supabase

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_ORG_ID`
- `SUPABASE_DB_PASSWORD`

### AI

- `DEEPSEEK_API_KEY`

### Deployment and application

- `GHCR_USERNAME`
- `GHCR_DEPLOY_TOKEN`
- `RATE_LIMIT_SALT`
- payment-provider secrets when merchant onboarding is complete

Protect the production environment with required reviewers and restrict deployments to `main`.

## Bootstrap workflow

Run:

```text
Actions → Bootstrap platform accounts → Run workflow
```

The workflow:

1. creates R2 state, upload, media and rights-evidence buckets;
2. stores Terraform state in R2;
3. provisions the DigitalOcean Droplet, firewall, monitoring and backups;
4. creates Cloudflare DNS records;
5. creates or discovers the Supabase project;
6. stores the Droplet address and Supabase project reference as GitHub environment variables.

The domain must already be added to Cloudflare and its nameservers must be delegated at the registrar.

## Production deployment workflow

Run:

```text
Actions → Deploy production → Run workflow
```

The workflow:

1. applies Supabase database migrations;
2. retrieves current Supabase API keys through the Management API;
3. builds and publishes immutable web and worker containers;
4. deploys the Cloudflare media gateway;
5. generates the server runtime environment from GitHub secrets;
6. deploys to DigitalOcean;
7. runs health and readiness tests.

## AI provider strategy

Default:

```text
AI_PROVIDER=deepseek
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

Jalwa uses an OpenAI-compatible Chat Completions adapter. Supported configurations:

- DeepSeek official API;
- OpenAI Chat Completions;
- another reviewed OpenAI-compatible provider.

Provider-specific code is kept behind one server-side module. Browser clients never receive the AI key.

## Moderation

Default moderation uses a small structured classification request to the configured provider plus deterministic hard-risk checks. OpenAI moderation can be enabled independently:

```text
AI_MODERATION_MODE=openai
OPENAI_MODERATION_API_KEY=...
```

Use `AI_MODERATION_MODE=local` only for development because it provides reduced coverage.

## Data controls

- send only the minimum approved catalogue context;
- do not send payment credentials, rights evidence or unpublished content;
- redact unnecessary personal data;
- keep provider and model version in the AI usage record;
- retain the ability to switch provider through environment configuration;
- review the selected provider's contract, privacy terms and data location before public launch.

## Human-only dependencies

CI/CD cannot complete:

- payment merchant KYC and commercial approval;
- registrar nameserver delegation;
- legal review;
- rights approval for the launch catalogue;
- acceptance of paid cloud-service terms.
