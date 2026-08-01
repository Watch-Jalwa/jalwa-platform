# Content, Commerce and Deployment Handoff

This is the current handoff after repository and frontend readiness. It separates backend deployment, media infrastructure, governed content onboarding, internal-alpha acceptance and later commerce activation so one workstream cannot silently authorize another.

## Current release

- `main`: `7f476e7ba0fd5c940fccc39b13f3ceb980a6d430`
- Vercel deployment: `dpl_8aJR63X2r7gJQy6XWkqs3b4m1uju`
- Vercel state: READY
- Current Vercel mode: noindex frontend preview until transactional backend values are connected
- Repository implementation: complete
- Transactional backend deployment: pending
- Internal-alpha activation: disabled
- Governed live catalogue: installed in code/database migrations but disabled

No additional feature development should begin before backend deployment and manual integration testing. Development resumes from reproduced defects and approved follow-up scope.

## Workstream 1 — Configure isolated staging

### Required owner inputs

- DigitalOcean account, region and restricted administrator CIDR;
- staging domain and DNS control;
- SSH keypair and independently verified Ed25519 host fingerprint;
- GHCR deployment credentials;
- generated self-hosted Supabase/PostgreSQL secrets;
- Cloudflare account, isolated R2 buckets and media-signing values;
- SMTP, AI, observability and application-operation secrets;
- age backup identity;
- staging mock-payment secret;
- internal tester IDs and named operations/rights/incident owners.

### Required AWS inputs when the managed media path is selected

- AWS account and region;
- environment-scoped GitHub OIDC role;
- encrypted Terraform state backend and locking;
- staging media domain and certificate/DNS control;
- CloudFront signing key pair;
- media-control and Supabase callback secrets;
- budget destination and monthly limit;
- KMS/log-retention policy.

### Exit evidence

- protected GitHub `staging` environment contains only dedicated staging values;
- all required values are non-example and independently verified;
- no production secret or bucket is reused;
- named deployment approver and stop-activation owner are recorded.

## Workstream 2 — Deploy the transactional backend

1. Run **Bootstrap staging** when infrastructure is absent.
2. Verify the host address and SSH fingerprint outside the workflow.
3. Run **Deploy staging** from the exact green `main` SHA selected for acceptance.
4. Verify web, worker, proxy, PostgreSQL, Auth and REST health.
5. Verify migration inventory and background-job readiness.
6. Retain deployment manifest and exact readiness SHA.
7. Verify pre-migration and post-deployment encrypted backups.
8. Run and retain the restore drill.
9. Exercise the tested transactional rollback path.
10. Run zero-content staging browser acceptance.

The deployment is incomplete when the frontend is reachable but the worker, database, Auth, REST, backups or readiness evidence are missing.

## Workstream 3 — Select and validate the media backend

### Safe first option

Use the existing rollback path:

```text
MEDIA_BACKEND=r2
TRANSCODE_BACKEND=ffmpeg
```

This is acceptable for the first staging integration cycle when R2 credentials and worker compute are ready.

### Managed AWS option

1. Run **Apply AWS media plane** with `apply=false`.
2. Review the exact Terraform plan and cost boundary.
3. Apply through the protected staging environment.
4. Verify private S3 access, SQS/DLQ, MediaConvert, CloudFront OAC, signed cookies, alarms and budgets.
5. Run **Set media backend** using `backend=aws`.
6. Verify upload, processing, completion callback, HLS playback and rollback to R2.

Do not create long-lived AWS keys on the application host. Use the implemented OIDC/HMAC/signing boundaries.

## Workstream 4 — Connect the Vercel frontend

After the backend is healthy:

1. configure the Vercel staging/production environment variables for the selected backend URL and public keys;
2. keep service-role, database, media-control and signing secrets server-side only;
3. redeploy the frontend;
4. verify `/api/health` and browser `data-release` show the exact Vercel deployment SHA;
5. verify backend readiness and application release evidence point to the intended release family;
6. confirm the preview banner/fallback catalogue no longer hides a missing backend connection;
7. keep noindex and internal-alpha restrictions active.

## Workstream 5 — Install governed source records

### Alpha source register

Install the 151 approved discovery lanes from `content/alpha-approved-sources.json`.

- Source-level approval permits metadata discovery only.
- It does not authorize an individual file for download, adaptation, monetisation or publication.
- Unsupported adapters remain installed but skipped.
- Every candidate retains source revision, original URL and rights metadata.

### Live-source inventory

Install the 52 governed source records representing 46 user-facing live entries.

- Keep every source disabled and unpublished at installation.
- Preserve official-embed, secured-current-image and official-link-only delivery boundaries.
- Do not restream, record or automatically upgrade link-only sources.

## Workstream 6 — Build the first 50-item internal-alpha catalogue

Use metadata harvesting to create candidates, then approve only items that pass the complete item-level workflow.

Recommended mix:

- 30 short-form items;
- 10 medium-form items;
- 5 long-form items;
- 5 audio/story or provider-linked items.

Every item must retain:

- canonical source URL and source-lane revision;
- creator/publisher;
- exact licence and licence URL or public-domain basis;
- evidence snapshot/hash and review date;
- attribution and modification notice;
- territory, monetisation and expiry decisions;
- third-party music, performer, privacy and trademark review;
- media checksum and processing outputs;
- editorial, rights and takedown owners;
- explicit availability state and audit history.

No metadata import may publish automatically. Stock libraries remain production ingredients, not unchanged catalogue programmes.

## Workstream 7 — Internal-alpha acceptance

### Platform journeys

- signup, verification, login, session renewal and password reset;
- profiles, devices, tester grant and tester revocation;
- Studio access and capability denial;
- candidate review, content promotion and publication;
- upload, processing, retry and DLQ recovery;
- search, feeds, collections, Shorts and watch pages;
- HLS adaptation and MP4 fallback;
- captions, keyboard, reduced-motion and low-data behavior;
- account export/deletion and protected diagnostics.

### Rights and takedown journeys

- source disable removes all child content from discovery and blocks new playback;
- item disable affects only that item;
- rights hold cancels/blocks processing and playback;
- rights expiry fails closed;
- urgent manifest/poster invalidation is exercised;
- restore requires current rights approval and explicit child restoration;
- attribution and evidence remain available to operators.

### Infrastructure journeys

- raw storage is private;
- signed CloudFront/R2 playback succeeds and expires as designed;
- queue retries and DLQ replay work;
- MediaConvert or FFmpeg failure is visible and recoverable;
- backup and restore drill pass;
- rollback returns to the previous media/backend state;
- monitoring, budget and incident alerts reach the named owners.

### Device acceptance

- Android Chrome;
- iPhone Safari;
- desktop Chrome/Chromium;
- 360–390px mobile layouts;
- constrained network and interrupted playback;
- PWA installation and service-worker behavior.

## Workstream 8 — Activate invite-only internal alpha

Use **Set internal alpha state** only after all preceding evidence exists.

Enablement must verify:

- exact deployed `main` SHA;
- healthy backend and release correlation;
- all required source approvals are current;
- at least 50 published, playable and explicitly available items;
- no rights holds or expired evidence;
- at least one active tester grant;
- retained acceptance artifacts and named sign-off.

Failed activation must roll back to disabled/invite-only. Do not enable through direct database edits or ad-hoc environment changes.

## Workstream 9 — Team manual testing and development restart

The project manager should return:

- staging URL;
- backend and frontend deployed SHAs;
- infrastructure/workflow run references;
- 50-item inventory and rights report;
- device/browser test results;
- security, backup, rollback and takedown results;
- known issues with reproduction steps and severity;
- signed alpha go/no-go decision.

After that handoff:

1. fix verified integration defects;
2. stabilize alpha operations and analytics;
3. prioritize the next product phase from actual tester evidence;
4. avoid reopening historical implementation PRs.

## Commerce and public production remain separate

Internal alpha does not activate live customer billing or constitute a public launch.

Before commerce or general production:

- confirm merchant entity, settlement, pricing, tax/receipt and refund/cancellation policy;
- select and onboard a Pakistan-compatible hosted checkout provider;
- test signed success, failure, duplicate, conflict, refund, dispute and reconciliation paths;
- approve legal/support/finance ownership;
- complete production infrastructure, content and incident acceptance;
- promote only an exact release already proven in staging.

## Open trackers

- #22 — umbrella backend, commerce and production activation.
- #52 — governed 46-entry live-catalogue activation.
- #59 — internal-alpha content/media deployment and 50-item acceptance.
