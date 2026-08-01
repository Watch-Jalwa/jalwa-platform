# Launch Runbook

This runbook covers isolated staging, invite-only alpha, governed live-source observation and production promotion. Do not skip directly from a Vercel frontend build to production.

## Release candidate selection

- select an exact green `main` commit;
- confirm lint, type checking, tests, migrations, dependency audit, SBOM, image vulnerability policy, production build, container boot and Chromium journeys are green;
- confirm no unresolved review thread or release-blocker issue applies to the SHA;
- confirm documentation and rollback/roll-forward notes are current;
- record the candidate SHA before deployment.

AI-affecting candidates must identify prompt, model, provider, retrieval and eval-set versions.

## Isolated staging preparation

- configure staging-only DigitalOcean, DNS, SSH, GHCR, Supabase, R2, SMTP, AI, observability, application and age-backup values;
- verify no production credential, bucket or account state is reused;
- verify R2 bucket names use the `jalwa-staging-*` prefix;
- independently verify the host Ed25519 fingerprint;
- keep mock payments limited to explicit staging;
- keep staging noindex and excluded from production analytics.

## Isolated staging deployment

1. Run **Bootstrap staging** if resources do not exist.
2. Verify host, DNS and SSH identity out of band.
3. Run **Deploy staging** from the selected exact SHA.
4. Confirm immutable web/worker images use that SHA.
5. Confirm pre-migration encrypted backup.
6. Confirm migrations apply in order.
7. Confirm readiness reports the exact SHA.
8. Confirm web, worker, proxy, PostgreSQL, Auth and REST health.
9. Confirm post-deployment backup, restore drill and rollback path.
10. Run automatic zero-content staging acceptance.
11. Connect and redeploy the Vercel frontend with public backend values only.

## First 50-item catalogue acceptance

- import the 151 approved discovery lanes;
- harvest metadata only through approved adapters;
- complete item-level rights and editorial review;
- process and QA approximately 30 short, 10 medium, 5 long and 5 audio/story or provider-linked items;
- publish and explicitly enable only passed items;
- confirm no import or transcode auto-publishes;
- verify search, feeds, collections, Shorts and watch pages;
- verify HLS/MP4, captions, constrained networks and token expiry;
- verify source/item disablement, rights hold, expiry and urgent takedown.

## Governed 46-entry live catalogue

- apply the 52-record manifest disabled and unpublished;
- retain dated source/terms evidence and review deadlines;
- confirm official embed, secured-image and official-link-only boundaries;
- verify all 22 link-only pages contain no iframe;
- pass provider/source health and mobile acceptance;
- exercise blocked, stale, off-air, degraded and emergency-unpublish states;
- observe staging continuously for seven days;
- activate only through the protected exact-SHA workflow.

## Platform acceptance

### Identity and privacy

- sign-up, verification, login, logout, password reset and session renewal;
- profiles, devices, tester grant and revocation;
- account export/deletion;
- unauthorized/expired-session behaviour;
- Studio role/capability separation.

### Rights and operations

- source, licence, attribution, evidence, territory, expiry and takedown completeness;
- fail-closed publication for incomplete/expired rights;
- immediate unpublish/takedown;
- support, moderation and operations queues;
- queue retries, DLQ replay, failed processing and late-job cancellation.

### Payments and Premium

- staging checkout creation and signed lifecycle events;
- duplicate/conflicting replay handling;
- partial/full refund and dispute representation;
- entitlement activation, expiry and revocation;
- Premium reports, ledgers, reconciliation and export permissions;
- privacy-safe, formula-protected and audited CSV exports.

### AI

- exact prompt/model/provider configuration recorded;
- `npm run test:ai` passed on the release;
- live staging eval covers citations, unsupported claims, Urdu/Roman Urdu, prompt injection, leakage, refusal, high-consequence safety, latency and cost;
- retrieved content cannot override system rules;
- private/unpublished data is not exposed;
- quota, moderation, provider failure and emergency disablement work;
- AI answers are clearly labelled and source-backed.

## Invite-only alpha activation

Before activation:

- at least 50 rights-complete, playable items are available;
- at least one active tester grant exists;
- backend, media, backups, restore, monitoring and incident ownership are healthy;
- required mobile/desktop and AI acceptance evidence is retained;
- no stop-activation condition remains.

Use only the protected **Set internal alpha state** workflow. Failed activation must roll back to disabled/invite-only.

## Production preparation

- production infrastructure, DNS, SSH, GHCR, Supabase, media and backup values are dedicated and verified;
- SMTP and enabled identity providers pass acceptance;
- AI quotas, moderation, provider configuration, data controls and cost alerts are approved;
- real hosted payment provider lifecycle and reconciliation pass;
- launch catalogue and legal/support ownership are approved;
- launch-day rollback and stop-launch authority are recorded.

## Production deployment

1. Confirm the SHA is green and proven in staging.
2. Run the protected production deployment workflow.
3. Preserve manifest, SBOM/provenance and host-acceptance artifacts.
4. Confirm readiness reports the exact SHA.
5. Confirm services, migrations and queues.
6. Confirm encrypted backups and restore verification.
7. Run protected API and desktop/mobile browser acceptance.
8. Run production AI smoke checks without private fixture data.
9. Conduct one controlled live merchant transaction when commerce is approved.
10. Verify receipt, entitlement and provider/Jalwa reconciliation.
11. Start monitoring and record the release.

## Stop-launch and rollback triggers

Stop promotion or roll back for:

- authentication/authorization bypass;
- exposed secrets, customer data, private media or unpublished AI context;
- duplicate charging or entitlement without verified payment;
- broad playback/account outage;
- readiness SHA mismatch;
- uncertain migration state;
- failed backup/restore verification;
- unresolved fixable critical/high image vulnerability;
- materially incorrect finance totals;
- serious rights complaint without containment;
- AI prompt injection, unsafe high-consequence output, citation failure or private-data leakage.

Rollback must restore the previous application image and reported version together. Database migrations are forward-only; use compatible roll-forward/recovery rather than rewriting applied migrations.

## Post-launch development restart

After retained production/internal-alpha evidence and an approved go/no-go decision:

- create issues from reproduced defects and measured tester needs;
- prioritize reliability, content operations and user value before speculative expansion;
- require every AI change to declare prompt/model/provider/eval impact;
- keep changes small, reversible and staging-proven;
- preserve rollback and emergency disablement authority.
