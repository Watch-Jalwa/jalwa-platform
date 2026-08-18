# Current Status and Next-Stage Gates

**Operational update:** 18 August 2026  
**Repository:** `Watch-Jalwa/jalwa-platform`  
**Primary branch:** `main`  
**Release-quality work:** PR #75

This document is the operational source of truth. Earlier roadmap documents explain product intent; this document distinguishes repository capability from the owner-controlled work still required for a transactional staging release and later production replacement.

## Executive status

The repository implementation required for the controlled internal alpha and permanent staging certification is substantially complete. The new self-hosted transactional staging environment has not yet completed live deployment/certification.

- The supported release target is an owner-controlled Linux server using SSH, Docker/Compose and immutable GHCR images. Vercel is not a required staging or production dependency.
- PostgreSQL is the source-of-truth database. Self-hosted Supabase provides Auth and REST/API services around PostgreSQL.
- R2/FFmpeg is the safe initial media option; the AWS S3/SQS/MediaConvert/CloudFront alternative remains implemented but separately protected.
- Invite-only internal-alpha access, source/content/asset availability controls, rights holds and emergency disablement are implemented but remain disabled until protected activation succeeds.
- Ask Jalwa has a provider adapter, versioned prompt registry, synthetic evaluation set, prompt-injection boundary, moderation, citations, quotas and usage/prompt audit records.
- The approved delivery model remains mobile-first responsive web/PWA only.
- PR #75 provides the permanent exact-SHA staging certification and directly gates the mandatory browser areas with the reusable Playwright suites.

No unrelated product feature is required before staging. Further code changes should be driven by deployment integration, failed certification, human UAT defects or an approved next phase.

## Audited release evidence

| Evidence | Result |
|---|---|
| Repository CI | migrations, privileges, audit, SBOM, lint, TypeScript, tests, build, containers, vulnerability policy and browser journeys |
| Database model | PostgreSQL with forward-only migrations and self-hosted Supabase Auth/REST integration |
| Immutable deployment | web/worker SHA images plus OCI revision/build-run labels |
| Staging artifact proof | `source SHA → deployment run → registry digest → running image ID → OCI revision` |
| Playwright certification implementation | public/Auth/responsive, Premium checkout/payment, Studio/Finance, catalogue/media and Mobile Chromium |
| Visual gate | human-approved SHA-256 baselines; first live run requires review |
| Production control | separate explicit approval; certification contains no production deployment action |

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

### AI-native platform

- provider-neutral Jalwa adapter with environment-configured provider/model;
- versioned Ask Jalwa prompt registry and stored prompt version;
- access-filtered catalogue retrieval and validated source citations;
- retrieved source/tool text treated as untrusted data;
- deterministic hard-risk checks and configurable moderation;
- English, Urdu and Roman Urdu output paths;
- synthetic evaluation fixtures for grounding, prompt injection, leakage and high-consequence scenarios;
- quotas, token/model records and emergency failure boundaries.

### Platform foundation

- generic owner-controlled self-hosted deployment path;
- PostgreSQL plus self-hosted Supabase Auth/REST;
- authentication, profiles, devices, watch history, privacy export/deletion and audit;
- payment/webhook/entitlement and Premium finance reporting boundaries;
- immutable SHA deployments, encrypted backups, restore drills, rollback and protected diagnostics.

## Current gate status

| Gate | Status | Evidence boundary |
|---|---|---|
| Repository implementation | Complete for staging candidate | reviewed PR/main code and CI |
| Database migrations and privileges | Complete in CI | clean PostgreSQL service |
| Dependency audit and SBOM | Complete in CI | GitHub CI |
| Web/worker production build | Complete in CI | GitHub CI |
| Container vulnerability/runtime checks | Complete in CI | GitHub CI |
| Permanent Playwright suite | Implemented | `qa/playwright/` |
| Self-hosted staging deployment contract | Implemented | `Deploy staging` + `docs/28-self-hosted-staging-environment.md` |
| Transactional self-hosted staging | Awaiting protected configuration/deployment | owner/DevOps host, DNS and credentials |
| Live staging certification | `BLOCKED` until staging exists | must return `READY FOR UAT`, `FAILED` or `BLOCKED` |
| First visual baseline approval | Not started | exact release SHA human review required |
| Selected media-plane acceptance | Not started | R2/FFmpeg or separately approved AWS path |
| 50-item alpha catalogue acceptance | Not started | item-level rights, processing and editorial QA required |
| Live AI configuration evaluation | Not started | exact prompt/model/provider/retrieval staging evidence required |
| Invite-only alpha activation | Disabled | protected exact-SHA workflow only |
| 46-entry live catalogue activation | Disabled | rights evidence, observation and protected workflow required |
| Commerce/provider activation | Blocked externally | merchant onboarding, policy and credentials required |
| Production replacement | Not authorized | requires staging certification, UAT and explicit owner approval |

## Owner-controlled staging configuration

Use [Self-hosted staging environment contract](28-self-hosted-staging-environment.md) as the definitive variable/credential list. It separates:

- values generated by DevOps during server/PostgreSQL/Supabase setup;
- values supplied or authorized by the owner/project manager;
- ordinary non-secret GitHub `staging` variables.

Do not reuse production values in staging. Staging must remain independently revocable. Do not put real credentials into repository files, issues, chat or WhatsApp.

## Required deployment sequence

1. Prepare the owner-controlled Linux staging host with Docker/Compose, a dedicated deployment user, restricted SSH, persistent storage, DNS and TLS.
2. Independently verify the SSH host fingerprint and configure the protected GitHub `staging` environment.
3. Merge the release-quality candidate only after repository checks and explicit owner approval.
4. Run **Deploy staging** from the exact green `main` SHA selected for acceptance.
5. Confirm readiness reports that exact SHA and web, worker, PostgreSQL, Auth, REST and required dependencies are healthy.
6. Retain pre-migration/post-deployment encrypted backups, restore-drill and rollback identity evidence.
7. Let **Staging certification** run automatically against the exact deployed release.
8. The workflow directly runs Playwright public/Auth/responsive, customer/payment, Studio/Finance and catalogue/media gates and retains sanitized HTML/JUnit/failure evidence.
9. Resolve every `FAILED` or `BLOCKED` result. A missing rights-approved catalogue fixture is `BLOCKED`, never PASS.
10. Review first-run visual evidence and bind any acceptance to the exact release SHA.
11. Proceed to human UAT only when certification reports `READY FOR UAT`.
12. Run the remaining content/media/AI/internal-alpha acceptance appropriate to the approved phase.
13. Production remains separate: after explicit owner approval, promote the exact tested immutable artifacts to the owner-controlled production host, run smoke/health verification and retain rollback.
14. Retire the old production environment only after the replacement production host is verified healthy.

## Open operational trackers

The deployment/activation trackers remain:

- **#22 — Deploy, test and activate the Jalwa transactional platform:** umbrella backend, staging/UAT and production activation tracker.
- **#52 — Activate the approved 46-entry live catalogue:** source-specific rights, staging observation and controlled activation.
- **#59 — Deploy and accept the internal-alpha content and media platform:** media selection, 50-item acceptance and invite-only activation.
- **#71 — Permanent staging certification:** exact-artifact automated release-quality gate.

New issues should be created only for a concrete deployment blocker, integration defect, certification/UAT failure or approved post-alpha scope. Do not reopen completed implementation work simply to track missing credentials.

## Stop-activation conditions

Do not enable internal alpha or approve production when any of the following is true:

- deployed SHA does not match retained release evidence;
- certification is `FAILED` or `BLOCKED`;
- authentication, RLS or tester revocation fails;
- source/item kill switch does not block discovery and new playback;
- raw private storage is accessible without authorization;
- item-level rights or attribution is incomplete;
- queues are stuck or recovery is unproven;
- required browser/media acceptance fails;
- Ask Jalwa exposes private/unpublished data or fails required safety/citation/language acceptance;
- backups or restore drill fail;
- monitoring or incident ownership is missing;
- serious security, privacy, payment or copyright issue is not contained.

## Safe waiting state

While DevOps prepares the server and the project manager supplies remaining protected values:

- keep internal alpha and governed live-source runtime flags disabled;
- keep mock payments only and production credentials isolated;
- keep staging noindex;
- do not bulk-download or transcode candidates without item-level approval;
- do not start unrelated feature development;
- complete repository/deployment/test preparation that does not require credentials;
- record deployment findings against #22, #52, #59 or #71 as appropriate;
- resume product development only for verified integration defects, failed gates or the next approved product phase.
