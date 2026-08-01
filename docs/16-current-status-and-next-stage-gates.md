# Current Status and Next-Stage Gates

**Audit date:** 1 August 2026  
**Repository:** `Watch-Jalwa/jalwa-platform`  
**Primary branch:** `main`  
**Audited release SHA:** `7f476e7ba0fd5c940fccc39b13f3ceb980a6d430`

This document is the operational source of truth. Earlier roadmap documents explain product intent; this document distinguishes implemented repository capability, deployed frontend evidence and the owner-controlled work still required for a transactional internal alpha.

## Executive status

The repository implementation required for a controlled internal alpha is complete and fully validated. The transactional backend and AWS media resources have not yet been deployed or activated.

- The Vercel frontend deployment is ready and reports the audited SHA through `/api/health` and the root page release marker.
- The Vercel environment is intentionally noindex and still operates as a frontend preview when backend values are absent.
- Supabase/PostgreSQL remains the catalogue, rights, identity, workflow and audit control plane.
- The existing R2/FFmpeg media path remains available as a rollback option.
- The AWS S3/SQS/MediaConvert/CloudFront media plane is implemented as Terraform and protected workflows but has not been applied with owner credentials.
- Invite-only internal-alpha access, source/content/asset availability controls, rights holds and emergency disablement are implemented but remain disabled until protected activation succeeds.
- The approved delivery model remains mobile-first responsive web/PWA only.

No additional speculative feature development is required before deployment. Further code changes should be driven by actual backend integration and manual acceptance findings.

## Audited release evidence

| Evidence | Result |
|---|---|
| Final `main` SHA | `7f476e7ba0fd5c940fccc39b13f3ceb980a6d430` |
| Internal-alpha implementation | PR #60, merge SHA `ffe439ce1481f690f305fae3f681b7550c2b697e` |
| Vercel health SHA correction | PR #61 |
| Browser release-marker correction | PR #62 |
| Vercel production deployment | `dpl_8aJR63X2r7gJQy6XWkqs3b4m1uju`, READY |
| Public health response | HTTP 200, `status: ready`, exact audited SHA |
| Full repository CI | migrations, privileges, audit, SBOM, lint, TypeScript, tests, build, containers, vulnerability policy and browser journeys passed |
| AWS infrastructure contract | Lambda syntax, Terraform format/init/validate passed |

## Implemented repository capabilities

### Consumer and Studio

- responsive PWA shell, Urdu/RTL foundation and mobile navigation;
- catalogue, categories, search, watch pages, Shorts and official embeds;
- self-hosted MP4/HLS player and signed playback-session boundary;
- Studio content, rights, moderation, support, finance, operations and internal-alpha workspaces;
- explicit unavailable, rights-hold and processing states;
- tester grants, source toggles, candidate review and emergency alpha controls.

### Rights-first content system

- 151 approved source lanes stored in `content/alpha-approved-sources.json`;
- approval limited to metadata discovery until item-level evidence passes;
- source candidates and governed draft promotion;
- item-level licence/evidence, attribution, expiry, hold and audit controls;
- database-owned effective availability and fail-closed public policies;
- source-, content-, playback- and asset-level disablement;
- secure source downloader with URL, network, size and checksum boundaries;
- metadata harvest tooling and protected workflow.

### Live-source catalogue

- 46 user-facing entries backed by 52 governed source records;
- official embeds, secured government current-image sources and official-link-only institutional sources;
- protected exact-SHA activation workflow with rights freshness and mobile acceptance;
- database records install disabled and unpublished;
- no automatic public exposure from a normal deployment.

### Media and infrastructure

- R2/FFmpeg MP4 and HLS processing remains supported;
- `MEDIA_BACKEND=r2|aws` and `TRANSCODE_BACKEND=ffmpeg|mediaconvert` boundaries;
- private AWS incoming and processed buckets, KMS, SQS/DLQ, MediaConvert, completion callbacks, CloudFront OAC, signed cookies, alarms and budgets;
- protected AWS plan/apply and backend-switch workflows;
- long-form HLS ladder and short-form optimized MP4 outputs;
- queue reconciliation, idempotency and late-completion availability safeguards.

### Platform foundation

- self-hosted Supabase/PostgreSQL deployment path;
- authentication, profiles, devices, watch history, privacy export/deletion and audit;
- payment/webhook/entitlement and Premium finance reporting boundaries;
- catalogue-grounded AI gateway, moderation and quotas;
- immutable SHA deployments, encrypted backups, restore drills, rollback and protected diagnostics.

## Current gate status

| Gate | Status | Evidence boundary |
|---|---|---|
| Repository implementation | Complete | merged `main` |
| Database migrations and privileges | Complete | clean CI PostgreSQL |
| Dependency audit and SBOM | Complete | GitHub CI |
| Web/worker production build | Complete | GitHub CI |
| Container vulnerability and runtime acceptance | Complete | GitHub CI |
| Desktop/mobile browser journeys | Complete | pinned Chromium harness |
| AWS Terraform/Lambda contract | Complete | GitHub CI |
| Vercel frontend deployment | Complete | frontend/noindex evidence |
| Transactional staging backend | Awaiting external configuration | GitHub environment, host, DNS and secrets required |
| AWS media plane apply | Awaiting external configuration | AWS account, OIDC, state, certificate, DNS and signing values required |
| Vercel-to-backend connection | Not started | deploy backend first |
| 50-item alpha catalogue acceptance | Not started | item-level rights, processing and editorial QA required |
| Invite-only alpha activation | Disabled | protected exact-SHA workflow only |
| 46-entry live catalogue activation | Disabled | rights evidence, staging observation and protected workflow required |
| Commerce/provider activation | Blocked externally | merchant onboarding, policy and credentials required |
| General production launch | Not started | staging and operational approvals required |

## Owner-controlled staging configuration

The project manager must configure the protected `staging` environment with dedicated values for:

- DigitalOcean host, restricted CIDR, deploy user, SSH private key and pinned known-host entry;
- staging domain and DNS;
- GHCR credentials and immutable image access;
- generated PostgreSQL, JWT, anon, service-role, dashboard, vault, metadata, log and pooler secrets;
- Cloudflare account/token, R2 incoming/processed/backup buckets and media-signing values;
- AWS account, region, Terraform state, GitHub OIDC role, KMS, S3, SQS, MediaConvert and CloudFront configuration;
- CloudFront signing key group and private key;
- media-control and callback secrets;
- SMTP, AI, observability and application-operation secrets;
- staging mock-payment webhook secret;
- age identity for encrypted backups;
- internal tester user IDs and named rights/operations/incident owners.

Do not reuse production values in staging. Staging must remain independently revocable.

## Required deployment sequence

1. Configure the protected staging environment and owner-controlled accounts.
2. Run **Bootstrap staging** when the host and DNS do not exist.
3. Verify host address and Ed25519 fingerprint independently.
4. Run **Deploy staging** from the audited or a newer fully green `main` SHA.
5. Confirm readiness reports that exact SHA and all core services are healthy.
6. Retain pre-migration/post-deployment encrypted backups and restore-drill evidence.
7. Review and apply the AWS media Terraform plan through the protected workflow, or explicitly select R2/FFmpeg for the first acceptance cycle.
8. Switch the media backend through the protected workflow and verify rollback.
9. Connect the Vercel frontend to staging backend values and redeploy.
10. Install the 151-lane source register and the disabled 46-entry live inventory.
11. Harvest metadata candidates and approve at least 50 mixed assets through item-level rights, processing and editorial QA.
12. Test authentication, Studio, uploads, queues, HLS, Shorts, search, takedown, backup, rollback and observability.
13. Run Android Chrome, iPhone Safari and desktop manual acceptance.
14. Enable invite-only internal alpha only through the protected exact-SHA workflow.
15. Record environment URL, deployed SHA, workflow artifacts, test report, known issues and sign-off.

## Open operational trackers

Only these issues should remain open during the deployment wait state:

- **#22 — Complete live staging, content, commerce and production activation:** umbrella backend and launch tracker.
- **#52 — Activate the approved 46-entry live catalogue:** source-specific rights, staging observation and controlled activation.
- **#59 — Internal-alpha content/media deployment:** AWS/R2 selection, 50-item acceptance and invite-only activation.

New issues should be created only for a concrete deployment blocker, integration defect or manually reproduced acceptance failure. Do not reopen completed implementation PRs to track missing credentials.

## Stop-activation conditions

Do not enable internal alpha when any of the following is true:

- deployed SHA does not match retained release evidence;
- authentication, RLS or tester revocation fails;
- source/item kill switch does not block discovery and new playback;
- raw private storage is accessible without authorization;
- item-level rights or attribution is incomplete;
- queues are stuck or DLQ recovery is unproven;
- HLS fails on required browsers or constrained networks;
- backups or restore drill fail;
- monitoring, budget or incident ownership is missing;
- serious security, privacy, payment or copyright issue is not contained.

## Safe waiting state

While the deployment team configures and tests the backend:

- keep internal alpha and governed live-source runtime flags disabled;
- keep Vercel noindex and clearly identified as a frontend preview;
- do not bulk-download or transcode candidates without item-level approval;
- do not start unrelated feature development;
- record deployment findings against #22, #52 or #59;
- resume development only for verified integration defects or the next approved product phase.
