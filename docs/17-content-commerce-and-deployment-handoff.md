# Content, Commerce and Deployment Handoff

This is the current handoff for the owner-controlled staging and production path. It separates self-hosted deployment, media infrastructure, governed content onboarding, AI acceptance, internal-alpha activation and later commerce activation so one workstream cannot silently authorize another.

## Release identity

- Repository implementation: staging candidate is represented by the exact reviewed/green `main` SHA selected for deployment.
- Current release identity is always read from `/api/health`, the browser release marker and captured running-container evidence; mutable documentation is not an authority for a deployed SHA.
- Supported deployment target: owner-controlled Linux servers using SSH, Docker/Compose and immutable GHCR images.
- PostgreSQL is the source-of-truth database; self-hosted Supabase provides Auth and REST/API services around PostgreSQL.
- Vercel is not part of the required staging or production release path.
- Transactional staging deployment/certification: pending owner-controlled host configuration and protected credentials.
- Internal-alpha activation: disabled.
- Governed live catalogue: disabled until its protected acceptance process succeeds.
- AI development baseline: versioned prompts/evals and deterministic checks implemented; live exact-configuration evaluation remains a later staging gate.

No unrelated feature development should begin before staging deployment/certification. Development resumes from reproduced integration/certification defects and approved follow-up scope.

## Workstream 1 — Prepare isolated self-hosted staging

The definitive environment-variable and credential ownership list is [docs/28-self-hosted-staging-environment.md](28-self-hosted-staging-environment.md).

### DevOps can complete before PM credentials arrive

- prepare the Linux host, Docker Engine and Docker Compose;
- create the dedicated non-root deployment user (`jalwa` by default);
- create `/opt/jalwa/{scripts,systemd,migrations,supabase,backups/postgres,operations,secrets,deployments}` with correct ownership;
- configure firewall/restricted SSH access and system updates;
- prepare persistent storage for PostgreSQL/Supabase and backups;
- generate the SSH deployment key and independently capture the server host key;
- generate the self-hosted PostgreSQL/Supabase internal secrets listed in `docs/28-self-hosted-staging-environment.md`;
- prepare DNS/TLS records once the staging domain is known;
- validate server capacity for web, worker, PostgreSQL, Supabase Auth/REST and FFmpeg processing.

### Owner / project-manager inputs

The owner/PM supplies or authorizes the external-service and QA values listed in `docs/28-self-hosted-staging-environment.md`, including the staging domain, GHCR deploy access, Cloudflare/R2, SMTP, AI/observability values and synthetic QA identities where required.

No real secrets belong in repository files, issues, chat or WhatsApp. Store them in the protected GitHub `staging` environment or the approved server-side secret location.

### Exit evidence

- owner-controlled staging host is reachable over pinned SSH;
- protected GitHub `staging` environment contains dedicated staging values only;
- generated self-hosted PostgreSQL/Supabase values are internally consistent;
- no production credential, bucket or database is reused;
- DNS/TLS is valid for customer and API endpoints;
- named deployment approver and stop-activation owner are recorded.

## Workstream 2 — Deploy the transactional stack

The existing **Deploy staging** workflow already targets a generic SSH/Docker host; it does not require Vercel or DigitalOcean provisioning.

1. Confirm the server prerequisite work above is complete.
2. Independently verify the host address and SSH fingerprint outside the workflow.
3. Merge the release-quality candidate only after repository checks and explicit owner approval.
4. Run **Deploy staging** from the exact green `main` SHA selected for acceptance.
5. Build/push immutable web and worker GHCR images for that SHA.
6. Write the protected Jalwa/Supabase runtime environments on the server.
7. Prepare self-hosted Supabase/PostgreSQL and apply migrations.
8. Deploy web, worker and reverse-proxy services transactionally.
9. Capture exact running container IDs, local image IDs, GHCR digests, OCI revision/build-run labels and previous rollback release.
10. Verify web, worker, PostgreSQL, Auth and REST health.
11. Retain pre-migration and post-deployment encrypted backups and run the restore drill.
12. Exercise/retain the tested rollback path and host acceptance evidence.

The deployment is incomplete when the site is merely reachable but the worker, PostgreSQL, Auth, REST, exact-SHA identity, backup/restore or rollback evidence is missing.

## Workstream 3 — Run permanent automated staging certification

After a successful **Deploy staging** run, **Staging certification** starts automatically for the exact deployed release.

It must prove:

- source SHA → deployment run → immutable registry digest → running image ID → OCI revision;
- database-backed readiness, Auth, REST, security headers and runtime dependencies;
- Playwright public pages, user-facing magic-link request boundary and 360/390px responsive behavior;
- authenticated Premium checkout negative paths, authoritative price/currency and duplicate-submit idempotency;
- isolated mock payment → authoritative `succeeded` order → active subscription → exact entitlements;
- full Mobile Chromium Premium purchase;
- Studio/admin authorization, rights-reviewer least privilege, viewer denial and Finance reporting/export audit;
- representative catalogue/watch/media boundary and enabled governed live-source behavior;
- public visual-regression evidence.

The reusable specs in `qa/playwright/` are now directly invoked for the public/Auth/responsive, customer/payment, Studio/Finance and catalogue/media browser gates. Their HTML/JUnit/failure evidence is retained in the sanitized certification artifact.

Missing required infrastructure/configuration/fixtures is `BLOCKED`. A reproducible product/security/business assertion failure is `FAILED`. Only a complete accepted candidate can become `READY FOR UAT`.

The first real visual run intentionally requires human review because the baseline manifest starts empty. Any visual acceptance must be bound to the exact release SHA; CI never self-approves a visual change.

## Workstream 4 — Select and validate the media backend

### Safe first option

Use the existing staging path:

```text
MEDIA_BACKEND=r2
TRANSCODE_BACKEND=ffmpeg
```

This is the supported first staging integration cycle when isolated R2 credentials and worker compute are ready.

### Managed AWS option

The AWS path remains optional and separately protected. If selected later:

1. run the AWS media plan without apply;
2. review the exact Terraform plan/cost boundary;
3. apply only through the protected staging environment;
4. verify private S3 access, SQS/DLQ, MediaConvert, CloudFront OAC, signing, alarms and budgets;
5. switch the media backend through the protected control;
6. verify upload, processing, completion callback, HLS playback and rollback to R2.

Do not create long-lived AWS application-host keys or silently change media backend during the initial staging certification.

## Workstream 5 — Install governed source records

### Alpha source register

Install the approved discovery lanes from `content/alpha-approved-sources.json` when the content acceptance phase begins.

- Source-level approval permits metadata discovery only.
- It does not authorize an individual file for download, adaptation, monetisation or publication.
- Unsupported adapters remain installed but skipped.
- Every candidate retains source revision, original URL and rights metadata.

### Live-source inventory

Install governed live-source records disabled and unpublished.

- Preserve official-embed, secured-current-image and official-link-only delivery boundaries.
- Do not restream, record or automatically upgrade link-only sources.
- Activation remains a separate protected rights/observation gate.

## Workstream 6 — Build the first internal-alpha catalogue

Use metadata harvesting to create candidates, then approve only items that pass the complete item-level workflow.

Every published self-hosted item must retain the required source, licence/evidence, attribution, territory/monetisation/expiry, privacy/trademark, media-checksum, editorial, rights and takedown records. No metadata import may publish automatically.

A rights-approved published staging item is required for representative media Playwright certification. If none exists, the certification result is `BLOCKED`, never PASS.

## Workstream 7 — Human UAT

Human UAT begins **only after automated certification reports `READY FOR UAT`**.

Human testing focuses on what automated certification cannot fully approve: UX/usability, copy/content, visual quality, exploratory behavior, business acceptance and representative real-device experience.

Any reproducible defect found during UAT should gain a permanent regression test when it can be automated safely, then the corrected exact release must be re-certified.

## Workstream 8 — Internal-alpha/live/AI acceptance

These are later protected gates, not prerequisites for merely proving the staging platform itself unless the corresponding feature is enabled for the candidate.

- catalogue/content acceptance follows item-level rights rules;
- governed live sources remain disabled until rights/health/observation approval;
- Ask Jalwa remains disabled until exact prompt/model/provider/retrieval staging evaluation and emergency-disable evidence exist;
- invite-only internal alpha is enabled only through its protected exact-SHA workflow.

## Workstream 9 — Production promotion and old-production retirement

Production is never authorized automatically by staging certification or human UAT.

After the user/owner explicitly approves production:

1. identify the exact staging-tested/UAT-approved Git SHA;
2. retain its web/worker immutable GHCR digests and staging certification artifact;
3. take/verify the required production backup and rollback reference;
4. promote the **same tested immutable artifacts** to the owner-controlled production server rather than rebuilding a different release;
5. configure production-only secrets separately from staging;
6. run non-destructive production health/smoke checks and verify exact release identity;
7. keep rollback immediately available during the cutover observation window;
8. retire the old production environment only after the replacement is verified healthy.

A poor-performing or obsolete production environment may be removed after successful replacement verification; it must not be destroyed before the tested replacement and rollback path are proven.

## Commerce remains separate

Staging uses the isolated mock payment provider. Internal alpha does not activate live customer billing.

Before real commerce activation, complete merchant onboarding, pricing/tax/refund/support ownership and sandbox/UAT tests for the selected hosted payment provider. Real payment credentials are not required for the current staging certification.

## Open trackers

- #22 — umbrella backend, staging/UAT, commerce and production activation.
- #52 — governed live-catalogue activation.
- #59 — internal-alpha content/media deployment and acceptance.
- #71 — permanent automated staging certification and release-quality control.
