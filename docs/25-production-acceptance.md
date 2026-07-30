# Production acceptance and launch catalogue

This is the final repository-side gate. Deployment is accepted only after both the public and host checks pass.

## Launch catalogue workflow

Prepare a JSON Lines file using `content/launch-catalogue.example.jsonl` as the field reference. One JSON object represents one content item.

Validate without changing the database:

```bash
node scripts/import-launch-catalogue.mjs content/launch-catalogue.jsonl --min=100
```

Import validated records as drafts:

```bash
set -a
source /opt/jalwa/.env.production
set +a
node scripts/import-launch-catalogue.mjs content/launch-catalogue.jsonl --min=100 --commit
```

The importer never publishes content. It creates or updates draft content, a playback source, and a pending rights record. An editor and rights reviewer must still approve every item in Studio. AI review can flag issues but cannot approve rights.

Required per item:

- English, Urdu and Roman Urdu title metadata;
- category, audience and sensitivity classification;
- HTTPS source URL and attribution;
- explicit hosting or embedding permissions;
- a human-verifiable evidence reference;
- official YouTube no-cookie embeds or a self-hosted/partner source.

Do not include unlicensed movies, sports feeds, channels or downloaded YouTube media.

## Automated release acceptance

Run **Actions → Production release acceptance** after deployment. It also runs automatically after a successful `Deploy production` workflow.

Public checks include health/readiness, customer pages, HTTPS security headers, production indexing, Auth health, anonymous PostgREST access, minimum published catalogue size, active categories and non-mock payments.

Host checks include app containers, PostgreSQL/Auth/PostgREST health, migration records, backup timer state, R2 backup configuration and production payment configuration.

The workflow uploads a JSON acceptance report retained for 90 days.

## Human acceptance still required

Automation cannot approve merchant KYC, content licences, territorial rights, legal review, a real backup restore drill, device/network/accessibility testing, Urdu editorial review, AI-safety review or final go-live authorization.

Production is ready to open only when the automated workflow passes and the human acceptance record is signed off.
