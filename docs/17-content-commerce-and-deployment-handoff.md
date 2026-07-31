# Content, Commerce and Deployment Handoff

This is the operating plan after repository readiness. It keeps content acquisition, merchant/provider work and deployment evidence separate so one workstream cannot silently authorize another.

## Workstream 1 — Activate isolated staging

### Inputs

- DigitalOcean account and restricted administrator CIDR;
- Cloudflare account, zone and isolated R2 buckets;
- staging domain;
- SSH keypair and independently verified Ed25519 host fingerprint;
- generated self-hosted Supabase secrets;
- SMTP, AI, observability and application-operation secrets;
- GHCR deploy credentials;
- age backup identity.

### Execution

1. configure the GitHub `staging` environment;
2. run **Bootstrap staging** if infrastructure is absent;
3. verify host, DNS and SSH identity out of band;
4. run **Deploy staging** from a green `main` commit;
5. run automatic infrastructure acceptance;
6. retain manifests, health evidence, encrypted backups and restore-drill output.

### Exit evidence

- exact deployed commit SHA;
- healthy web, worker, proxy, database, Auth and REST services;
- migrations recorded as applied;
- no stuck background jobs;
- staging noindex and production analytics isolation;
- successful encrypted backup and restore drill;
- desktop/mobile browser acceptance artifact.

## Workstream 2 — Onboard the first content pilot

Start with a controlled pilot, not a 150-item bulk import. Target 20–30 items across three programmes:

- 8–10 official embeds from approved Pakistani or globally relevant channels;
- 8–10 public-domain or commercially reusable open-license items with original-source evidence;
- 4–10 Jalwa-owned cards, shorts, explainers or articles.

Recommended first programmes:

- **Deen:** official lecture embeds, Quran text integration and original reviewed cards;
- **Kissan:** original Urdu explainers using reviewed facts and licensed visuals;
- **Rozgar/Tech:** official tutorials plus original scam-awareness and skills content.

### Source approval record

Create one content-source issue for every source programme. Record:

- rights-holder/publisher and official URL;
- proposed delivery mode;
- licence or written permission;
- territory, duration and commercial scope;
- editing, subtitle and thumbnail permissions;
- attribution requirements;
- expiry/review date;
- takedown contact and internal owner;
- editorial, age, medical, religious or agricultural review needs;
- availability/reliability risk.

### Item-level publication record

Every item must retain:

- canonical source URL;
- creator/publisher;
- delivery/hosting mode;
- licence identifier and licence URL or contract reference;
- evidence snapshot/version and review date;
- exact attribution text;
- territory and expiry;
- monetisation compatibility;
- review owner and takedown owner;
- publication status and audit trail.

### Delivery rules

- YouTube and similar platforms: official embed only; no download, mirroring or premium paywall by default.
- Open-license media: verify the original item, not only an aggregator result.
- Public domain: verify the applicable jurisdiction and all embedded third-party elements.
- Jalwa original: retain contributor, music, performer, location and source-material clearances.
- Institutional/government material: do not assume public access equals commercial reuse permission.

### Pilot acceptance

- at least one published item per selected programme;
- complete rights evidence report;
- Urdu/Roman Urdu metadata and thumbnails reviewed;
- mobile playback and embed availability checked;
- takedown/unpublish path rehearsed;
- staging acceptance rerun with minimum published content `1` or higher;
- no item published automatically from an import.

## Workstream 3 — Commerce and Premium readiness

The repository contains payment and entitlement infrastructure, but live commerce requires business and provider inputs.

### Business decisions

- legal merchant entity and settlement account;
- monthly and optional annual price;
- tax treatment and invoice/receipt requirements;
- refund, cancellation, failed-payment and grace-period policy;
- customer support ownership and response targets;
- finance reconciliation owner;
- Premium benefit definition;
- whether any content is exclusive, early-access or ad-reduced.

Do not put officially embedded third-party content behind the Premium gate unless explicit rights and platform terms allow it.

### Provider selection

Evaluate Pakistan-compatible hosted checkout providers against:

- onboarding eligibility and settlement timing;
- cards, bank, wallet and mobile payment coverage;
- hosted checkout quality on low-end Android browsers;
- signed webhooks and replay identifiers;
- refunds, partial refunds, disputes and reconciliation exports;
- sandbox fidelity;
- support and incident handling;
- pricing and reserve requirements;
- data residency and privacy terms.

### Provider acceptance

Using staging/sandbox first, retain evidence for:

- checkout creation and hosted redirect;
- signed success and failure;
- duplicate delivery and identical replay;
- conflicting replay rejection;
- delayed success;
- partial and full refund;
- reversal/dispute;
- entitlement activation, expiry and revocation;
- receipt/support visibility;
- finance summary, ledger, reconciliation and CSV export agreement with provider records.

Production mock payments must remain disabled.

## Workstream 4 — Production deployment

### Required production inputs

- production DigitalOcean host and restricted CIDRs;
- production domain/DNS and pinned SSH identity;
- dedicated production Supabase, R2, SMTP, AI, observability and application secrets;
- GHCR pull credentials;
- active payment provider credentials;
- age backup identity and remote retention policy;
- named incident, support, finance, rights and stop-launch owners.

### Promotion sequence

1. select an exact green `main` commit already proven in isolated staging;
2. freeze launch-critical content and configuration;
3. run the manual production workflow;
4. verify immutable images, deployment manifest, SBOM/provenance and exact readiness SHA;
5. verify migrations, services, worker queues and backups;
6. run protected host and browser acceptance;
7. conduct one controlled live merchant transaction and reconciliation check;
8. monitor launch KPIs and error/payment events;
9. roll forward or execute the tested transactional rollback if a stop condition is reached.

### Stop-launch conditions

- duplicate charging or entitlement without verified payment;
- authentication/authorization bypass;
- exposed private media or secrets;
- broad playback or account outage;
- incorrect finance totals or missing reconciliation evidence;
- serious rights/takedown complaint without immediate containment;
- backup/restore failure;
- readiness SHA mismatch;
- unresolved fixed critical/high shipped vulnerability;
- AI disclosure of private or unpublished data.

## Store distribution decision

The current product is a PWA deployed on the web. After staging proves retention, playback, content operations and commerce, decide whether store packaging is justified.

A native/store workstream must separately define:

- Android/iOS packaging approach;
- Google Play and Apple developer accounts;
- store payment-policy impact on Premium;
- privacy nutrition/disclosure forms;
- age ratings and content declarations;
- screenshots, listing copy and support URLs;
- deep links, notifications, downloads and background behaviour;
- release signing, review, staged rollout and update ownership;
- representative device acceptance.

Do not wrap the website solely to claim store availability before the web product and support operation are stable.

## Recommended immediate order

1. load staging environment values;
2. bootstrap/deploy isolated staging and retain evidence;
3. approve three initial content programmes;
4. create content-source issues and onboard the 20–30 item pilot;
5. complete merchant/provider selection and sandbox integration;
6. run full staging customer, content and finance acceptance;
7. prepare production accounts, policies and owners;
8. promote a proven release;
9. evaluate native/store distribution after live web evidence exists.
