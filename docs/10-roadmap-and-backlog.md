# Delivery Roadmap and Backlog

This roadmap reflects the implemented repository and the active deployment gates. Detailed current evidence is maintained in [Current status and next-stage gates](16-current-status-and-next-stage-gates.md).

## Completed repository foundation

The repository implements the controlled internal-alpha platform, including:

- responsive web/PWA, identity, profiles, history and privacy workflows;
- catalogue, search, Studio, rights, moderation and support operations;
- self-hosted MP4/HLS, R2/FFmpeg and optional AWS media infrastructure;
- payment lifecycle, entitlements and Premium finance reporting;
- Ask Jalwa grounding, quotas, moderation, audit and prompt/eval baseline;
- immutable releases, encrypted backups, restore drills and rollback;
- clean migrations, dependency audit, SBOM, image scanning, container boot and browser journeys;
- 151 approved discovery lanes and a governed 46-entry live-source inventory.

Repository implementation does not prove a deployed transactional environment.

## Current phase — Isolated staging deployment

### Required work

- configure the protected `staging` environment with dedicated credentials and variables;
- bootstrap or verify the isolated DigitalOcean host, DNS and pinned SSH identity;
- deploy self-hosted Supabase/PostgreSQL, web, worker and proxy from an exact green SHA;
- configure isolated R2/FFmpeg or review/apply the AWS media plane;
- connect the Vercel frontend to the deployed backend;
- retain health, migration, backup/restore, rollback and browser evidence.

### Exit criteria

- all required services report healthy against the exact SHA;
- migrations and background jobs are correct;
- encrypted backups and restore drill pass;
- staging remains noindex and isolated from production accounts;
- authentication, Studio, media and protected diagnostics pass live acceptance.

## Current phase — First 50-item internal-alpha catalogue

Use the 151-lane register for metadata discovery only. Approve, process and publish at least 50 mixed items through item-level rights, media and editorial review.

Recommended mix:

- 30 short items;
- 10 medium items;
- 5 long items;
- 5 audio/story or provider-linked items.

Every item must retain source, creator, licence, evidence, attribution, territory, expiry, modification, takedown and named ownership data. Import or successful processing must never publish automatically.

## Current phase — Governed live catalogue

- apply migrations for all 52 source records representing 46 entries;
- keep records disabled/unpublished until approved in staging;
- retain current source and terms evidence;
- pass source health, official-link no-iframe checks and mobile acceptance;
- observe staging continuously for at least seven days;
- activate only through the protected exact-SHA workflow.

## Current phase — Internal-alpha acceptance

Complete live acceptance for:

- authentication, sessions, profiles, devices and tester revocation;
- catalogue, search, feeds, Shorts, watch history and PWA behaviour;
- Studio content, rights, moderation, support, operations and finance;
- upload, processing, HLS/MP4, queue retry and DLQ recovery;
- source/item kill switches, rights expiry and rights holds;
- Android Chrome, iPhone Safari, desktop, accessibility, Urdu/RTL and low-data use;
- backup, restore, rollback, monitoring, cost alerts and incident escalation;
- Ask Jalwa grounding, citation, language, safety, leakage, latency and cost on the exact deployed configuration.

Invite-only activation remains protected and fail-closed.

## Later gate — Commerce and public production

Before real customer billing or a public launch:

- confirm merchant entity, settlement, pricing, tax/receipt and policy ownership;
- onboard a Pakistan-compatible hosted checkout provider;
- pass signed success, failure, replay, refund, dispute and reconciliation scenarios;
- approve legal, privacy, support, finance, moderation, takedown and incident ownership;
- prove the exact release in isolated staging;
- deploy immutable production images and retain post-deployment acceptance.

## Post-deployment development restart

Further feature development begins only after the deployment/acceptance evidence is recorded and the next phase is approved from real tester and operational findings.

The first post-alpha planning cycle must:

1. rank reproduced defects and measured user needs;
2. preserve the modular-monolith boundary unless evidence requires separation;
3. create scoped issues with explicit data, rights, security, payment and AI impact;
4. establish success, failure and rollback metrics;
5. keep prompt/model/provider changes behind versioned prompts and evaluations;
6. prove relevant changes in staging before production promotion.

See [AI-native development readiness](26-ai-native-development-readiness.md).

## Product boundary — Mobile-first web/PWA only

Native Android/iOS applications and app-store distribution remain out of current scope. Acceptance must still cover representative Android and iOS browsers, constrained Pakistan networks, installability, responsive behaviour, playback and payments.

## Definition of done for repository features

- observable acceptance criteria met;
- mobile, low-data, Urdu/RTL and accessibility checked;
- tests added and full CI green;
- authorization enforced server-side;
- error, empty and partial-failure states handled;
- security/privacy, rights and payment impact reviewed;
- analytics and operational evidence defined;
- documentation and migration/recovery notes current;
- no unresolved fixable high/critical shipped vulnerability;
- AI changes use versioned prompts, updated evals and exact-configuration staging evidence;
- content changes preserve source, rights, attribution, expiry and takedown metadata.
