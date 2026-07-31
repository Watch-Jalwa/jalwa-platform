# Delivery Roadmap and Backlog

This roadmap now reflects the implemented repository rather than the original twelve-week estimate. Detailed current evidence is maintained in [Current status and next-stage gates](16-current-status-and-next-stage-gates.md).

## Completed foundation

The repository implements the core platform, catalogue, Studio, rights controls, authentication, media processing, payments/entitlements, Premium finance reporting, AI gateway and release engineering required for controlled staging.

Completed repository epics:

- platform foundation and responsive PWA;
- identity, profiles, history and account data workflows;
- catalogue, categories, search and discovery;
- Studio source/rights/publication governance;
- media upload, FFmpeg worker, MP4/HLS and signed playback;
- payment provider boundary, lifecycle normalization, subscriptions and entitlements;
- Premium finance definitions, ledgers, reconciliation and exports;
- Ask Jalwa gateway, quotas, moderation and catalogue citations;
- operations, support, moderation and diagnostics;
- isolated staging/production deployment workflows, encrypted backups, restore drills and rollback;
- CI migrations, audits, SBOM, image vulnerability policy, container boot and browser journeys.

## Current phase — Isolated staging activation

### Required work

- configure the GitHub `staging` environment with independently generated values;
- provision or confirm the isolated DigitalOcean host;
- configure staging DNS and pinned SSH identity;
- configure isolated Cloudflare R2 buckets and media gateway;
- deploy self-hosted Supabase services, web and worker images;
- retain readiness, migration, backup/restore and browser evidence;
- exercise authentication, email, mock checkout and finance reporting against the deployed stack.

### Exit criteria

- readiness reports the exact deployed SHA;
- all required services are healthy;
- migrations are applied and background jobs are not stuck;
- pre/post-deployment encrypted backups exist and restore successfully;
- protected API and desktop/mobile browser acceptance pass;
- staging remains noindex, analytics-isolated and mock-payment-only.

## Next phase — Content pilot

### Target

Onboard 20–30 reviewed items across Deen, Kissan and Rozgar/Tech using official embeds, verified open/public-domain material and Jalwa-owned content.

### Required work

- approve source programmes through structured content-source issues;
- retain item-level source, licence, attribution, territory, expiry and takedown evidence;
- create Urdu/Roman Urdu metadata and thumbnails;
- publish through human review only;
- verify mobile playback, embed availability and unpublish/takedown;
- rerun staging acceptance with published content.

### Exit criteria

- at least one complete published item per selected programme;
- no missing rights fields;
- editorial and safety review owners recorded;
- playback and takedown acceptance passed;
- a repeatable weekly content operating process exists.

## Next phase — Commerce provider and Premium offer

### Required work

- approve legal merchant entity and settlement account;
- choose monthly/annual pricing and Premium benefits;
- approve refund, cancellation, grace-period, receipt and support policy;
- select a Pakistan-compatible hosted checkout provider;
- configure sandbox credentials in staging;
- test signed success, failure, replay, delayed events, refunds, reversals/disputes and reconciliation;
- compare provider records with Jalwa summary, ledgers and CSV exports.

### Exit criteria

- provider onboarding and sandbox acceptance complete;
- entitlements activate/revoke only from verified server-side state;
- finance and support ownership defined;
- production mock payments remain disabled;
- customer-facing policy wording approved.

## Next phase — Closed beta

### Target

A controlled group of 50–100 Pakistan-based users on representative browsers and networks.

### Required work

- invite/account support process;
- low-end Android and mobile-network playback testing;
- Urdu/RTL and accessibility review;
- content demand and search-gap capture;
- payment conversion and failure monitoring in sandbox or controlled live mode;
- support response rehearsal;
- incident and rollback rehearsal.

### Exit criteria

- no unresolved critical defect;
- acceptable playback and authentication reliability;
- content and support operating rhythm demonstrated;
- finance reconciliation and backup evidence retained;
- launch blockers explicitly owned.

## Production launch phase

### Required work

- configure dedicated production infrastructure and secrets;
- activate and test the real hosted payment provider;
- approve launch catalogue and legal/support ownership;
- promote an exact green `main` SHA already proven in staging;
- retain immutable deployment manifest, SBOM/provenance and host acceptance;
- verify health, migrations, queues, backups and restore;
- conduct one controlled live transaction and reconciliation check;
- monitor and preserve rollback authority.

### Exit criteria

- all gates in the live activation issue are complete with evidence;
- production readiness reports the expected SHA;
- no unresolved security, payment, rights, privacy or backup blocker;
- named launch-day on-call and stop-launch authority;
- first-week KPI and operating cadence active.

## Later decision — Native/store distribution

Native packaging is not an MVP completion criterion. Evaluate it after web/PWA staging and live evidence establish that device distribution adds measurable value. A separate roadmap must cover store accounts, payment-policy compatibility, privacy disclosures, age ratings, signing, review and staged rollout.

## Definition of done for repository features

- acceptance criteria met;
- mobile and low-data behaviour checked;
- Urdu/RTL and accessibility checked;
- tests added and full CI green;
- analytics/observability defined;
- error and partial-failure states handled;
- authorization enforced server-side;
- security/privacy and content-rights impact reviewed;
- documentation updated;
- migration and rollback/roll-forward approach documented;
- no unresolved fixed high/critical shipped vulnerability;
- AI changes pass relevant safety and citation evaluations;
- content changes preserve source, rights, attribution, expiry and takedown metadata.
