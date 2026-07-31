# Launch Runbook

This runbook covers isolated staging, closed beta and production promotion. Do not skip directly from a Vercel frontend build to production.

## Release candidate selection

- select an exact green `main` commit;
- confirm lint, type checking, tests, migrations, dependency audit, SBOM, image vulnerability policy, production build, container boot and Chromium journeys are green;
- confirm no unresolved review thread or release-blocker issue applies to the SHA;
- confirm the change set has current documentation and rollback/roll-forward notes;
- record the candidate SHA before deployment.

## Isolated staging preparation

- configure staging-only DigitalOcean, DNS, SSH, GHCR, Supabase, R2, SMTP, AI, observability, application and age-backup values;
- verify no production credential is reused;
- verify R2 bucket names use the `jalwa-staging-*` prefix;
- independently verify the host Ed25519 fingerprint before storing known hosts;
- keep mock payments enabled only in explicit staging;
- keep live streaming and web DRM disabled;
- confirm staging is noindex and excluded from production analytics.

## Isolated staging deployment

1. Run **Bootstrap staging** if the host/resources do not exist.
2. Verify provisioned host, DNS and SSH identity out of band.
3. Run **Deploy staging** from the selected `main` SHA.
4. Confirm immutable web/worker images were pushed using the exact SHA.
5. Confirm pre-migration encrypted backup completed.
6. Confirm migrations applied in order.
7. Confirm deployment readiness reports the exact SHA.
8. Confirm web, worker, proxy, PostgreSQL, Auth and REST health.
9. Confirm post-deployment backup and restore drill.
10. Run automatic staging release acceptance.

## Staging customer and content acceptance

### Identity and privacy

- sign-up and email verification;
- login, logout and session renewal;
- password reset;
- profile/family and device controls;
- account export and deletion request processing;
- unauthorized/expired session behaviour;
- role and capability separation in Studio.

### Catalogue and playback

- home, categories, search, content page and related discovery;
- official embed availability and fallback;
- self-hosted MP4/HLS playback and token expiry;
- watch history and resume;
- Shorts and mobile gestures;
- PWA install/offline surfaces;
- low-end Android and constrained-network behaviour;
- Urdu/RTL and accessibility.

### Rights and operations

- item source, licence, attribution, evidence, territory, expiry and takedown completeness;
- publication rejection for incomplete/expired rights;
- immediate unpublish/takedown;
- support, moderation and operations queues;
- no automatic publication from batch import.

### Payments and Premium

- hosted/mock staging checkout creation;
- signed success and failure;
- duplicate and conflicting replay handling;
- delayed payment state;
- partial/full refund and reversal/dispute representation;
- entitlement activation, expiry and revocation;
- cancellation-at-period-end;
- Premium summary, ledgers, recurring customers and reconciliation;
- separate report/export permissions;
- CSV redaction, formula protection and export audit evidence;
- desktop and 390×844 mobile report screens.

## Closed beta readiness

Before inviting users:

- at least 20–30 rights-complete catalogue items;
- at least three coherent content programmes;
- support mailbox and named escalation owner;
- privacy, terms, refund/cancellation and takedown wording approved;
- analytics/error/payment dashboards active;
- daily content and support operating rhythm defined;
- backup/restore and rollback rehearsed;
- known limitations disclosed to testers;
- no unresolved critical defect.

## Production preparation

- production DigitalOcean host provisioned with restricted administrator CIDRs;
- production DNS and pinned SSH identity configured;
- GHCR pull credentials validated;
- dedicated production Supabase and R2 values loaded;
- SMTP verification/reset delivery tested;
- AI quotas, moderation and cost alerts configured;
- observability alerts and destinations configured;
- real Pakistan-compatible hosted payment provider active;
- signed provider lifecycle acceptance complete;
- pricing and Premium benefits approved;
- launch catalogue frozen with complete rights evidence;
- support, finance, moderation, incident and takedown owners named;
- launch-day rollback and stop-launch authority recorded.

## Production deployment

1. Confirm the release SHA is green and was proven in isolated staging.
2. Run the manual production deployment workflow.
3. Preserve the deployment manifest, SBOM/provenance and host-acceptance artifact.
4. Confirm readiness reports the exact SHA.
5. Confirm services, migrations and worker queues.
6. Confirm pre-migration/post-deployment off-site backups and restore verification.
7. Run protected API and desktop/mobile browser acceptance.
8. Conduct one controlled live merchant transaction.
9. Verify receipt, entitlement and provider/Jalwa reconciliation.
10. Start launch monitoring and record the release.

## Launch-day checks

### Technical

- DNS, TLS and security headers;
- home, search, player, login, account and checkout;
- exact readiness SHA;
- analytics and observability;
- AI quota/moderation;
- media token expiry;
- database/worker health;
- payment events and reconciliation;
- backup completion.

### Content

- featured items available;
- external embeds working;
- attribution and rights display correct;
- expiry/takedown monitor active;
- first seven days of updates scheduled;
- complaint/takedown channel staffed.

### Commercial and support

- monthly and any annual purchase;
- receipt and settlement visibility;
- refund/cancellation route;
- failed-payment and pending-order support;
- checkout abandonment monitoring;
- finance export and reconciliation access;
- escalation macros and ownership.

## Stop-launch and rollback triggers

Immediately stop promotion or execute rollback for:

- duplicate charging;
- entitlement without verified payment;
- authentication/authorization bypass;
- exposed secrets, customer data or private media;
- broad playback/account outage;
- readiness SHA mismatch;
- failed migrations with uncertain data state;
- failed backup or restore verification;
- fixed critical/high vulnerability in shipped images;
- materially incorrect finance totals;
- serious rights complaint without immediate containment;
- AI disclosure of private or unpublished information.

Rollback must restore the previous application image and reported version together. Database migrations are forward-only; use the documented compatible roll-forward/recovery plan rather than rewriting applied migrations.

## Payment fallback

If a provider callback is delayed:

- keep the order pending;
- do not activate from a screenshot or browser return URL;
- verify the provider portal and webhook/event history;
- record a finance reconciliation case;
- only authorized staff may grant a time-limited manual entitlement with reason and audit entry;
- reconcile and remove/replace the manual grant when verified provider state arrives.

## First-week operating rhythm

Daily:

- new/verified users and active viewers;
- playback and authentication failures;
- payment attempts, success, pending and failed states;
- Premium activations, renewals, cancellations and refunds;
- reconciliation exceptions;
- catalogue availability and rights/takedown alerts;
- AI usage/cost and moderation events;
- support backlog and severity;
- backups and worker queues.

Weekly:

- retained viewers and conversion;
- churn/renewal and recurring customers;
- top and underperforming categories;
- source reliability and content supply;
- gross collections, refunds, net collections and MRR/ARR;
- support and rights incidents;
- experiments and next release candidate.
