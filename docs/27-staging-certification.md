# Permanent staging certification

Status: implementation branch in progress; live execution remains blocked until the protected staging environment is deployed and configured.

Control issue: #71. Implementation trackers: #72, #73 and #74. Deployment control: #22.

## Purpose

A reachable staging site is not release evidence. Every successful **Deploy staging** run must be followed by machine-verifiable certification of the exact running release before human UAT begins.

Permanent flow:

`Code / PR → unit/build/security checks → immutable staging deployment → exact running-artifact proof → automated staging certification → READY FOR UAT → human UAT → explicit production approval → exact-artifact promotion → production smoke`

Automated certification never authorizes production.

## Actual Jalwa architecture

Jalwa is one private monorepo, not separate customer/backend/admin/dispatcher repositories:

- `apps/web` — customer web/PWA, server API routes and Studio/admin surfaces;
- `apps/worker` — background jobs and media processing;
- PostgreSQL/Supabase — database, Auth and REST control plane;
- Cloudflare R2/FFmpeg — initial staging media path, with the separately protected AWS media plane available later;
- Vercel — frontend deployment evidence, not the transactional staging backend.

There is no current native mobile app, GraphQL service, Redis dependency, restaurant product cart, delivery/take-away flow, branch dispatcher or cross-branch order domain. Generic QA scenarios for those capabilities are `N/A` until the product actually adds them. They must never be claimed as automated merely because a generic checklist mentions them.

Actual commerce is authenticated Premium subscription checkout with `prices`, `checkout_orders`, payment attempts, subscriptions and entitlements. Actual Studio roles are `viewer`, `subscriber`, `editor`, `rights_reviewer`, `support`, `finance` and `admin`; Studio staff routes accept only the applicable staff roles and sensitive Premium reporting uses explicit capabilities.

## Staging endpoints

The protected staging domain is environment-controlled:

- Customer Web: `https://${STAGING_DOMAIN}`
- Studio/Admin: `https://${STAGING_DOMAIN}/studio`
- API/transactional web routes: `https://${STAGING_DOMAIN}/api/*`
- Supabase Auth/REST: `https://api.${STAGING_DOMAIN}`
- Media gateway: `https://media.${STAGING_DOMAIN}`

The exact domain is not hard-coded into release evidence.

## Gate zero — deployed artifact identity

Staging web and worker images are built from the selected Git SHA with immutable SHA tags and OCI labels:

- `org.opencontainers.image.revision=<source SHA>`
- `com.watch-jalwa.build-run-id=<Deploy staging run ID>`

After deployment, `capture-release-identity.sh` records for both running services:

- expected source SHA;
- deployment pipeline/run ID;
- configured image reference;
- running container ID;
- immutable local image ID;
- immutable GHCR repository digest;
- OCI revision;
- build run label;
- previous known-good rollback release.

`verify-release-identity.mjs` validates that chain before browser certification. Missing identity evidence is `BLOCKED`; a proven mismatch is `FAILED`.

## Mandatory certification areas

The permanent workflow requires results for all of these areas:

1. deployment identity;
2. API/runtime readiness;
3. public desktop/mobile browser journeys;
4. authenticated Premium checkout;
5. enabled staging payment path;
6. Studio/admin and least-privilege authorization;
7. catalogue/media playback boundary;
8. complete Mobile Chromium Premium purchase;
9. public visual regression.

A missing mandatory result is automatically `BLOCKED`.

### Customer and payment boundary

The customer suite uses a deterministic staging-only account generated through the protected Supabase admin boundary. It verifies unauthenticated checkout denial, invalid checkout input, authenticated Premium checkout, server-authoritative amount/currency, duplicate-submit idempotency, mock staging payment completion and full Mobile Chromium purchase.

Staging uses the repository's isolated mock provider. Provider states not implemented by that adapter are not invented. When a real provider is later enabled in staging, its sandbox/UAT paths become mandatory and unavailable sandbox configuration must produce `BLOCKED`.

### Studio authorization

The Studio suite creates deterministic staging-only `admin`, `rights_reviewer` and `viewer` identities and verifies anonymous denial, core admin surfaces, finance API authorization, restricted-role denial and non-staff denial. Existing Premium reporting acceptance also covers Finance versus non-Finance reporting UI/API boundaries and audited CSV exports.

There is no Dispatcher Branch A/B role in Jalwa today; those scenarios are `N/A` rather than fake coverage.

### Catalogue and media

A real published staging catalogue item must be available for representative `/watch/<slug>` certification. No published item results in `BLOCKED`, not PASS. The browser verifies a real media surface or the documented safe unavailable boundary and rejects same-origin request or browser failures. Enabled governed live-source checks remain mandatory when their staging flag is enabled.

### Visual regression

Only public, non-sensitive screens are captured for source-controlled visual comparison: home, explore, pricing and login. `qa/visual-baselines/manifest.json` stores human-approved screenshot hashes. CI never updates baselines.

A missing or changed baseline produces `VISUAL REVIEW REQUIRED`, which blocks UAT unless an explicit review reference is configured. The first real staging run intentionally requires baseline review because the manifest starts empty.

Authenticated/customer/payment-sensitive flows do not enable Playwright trace or video capture. Evidence must never include credentials, tokens, cookies, real customer data or payment details.

## Decisions

The finalizer can produce only:

- `READY FOR UAT` — every mandatory gate passed or an allowed visual review was explicitly accepted;
- `FAILED` — a reproducible application, security, authorization, business, payment, media or identity failure exists;
- `BLOCKED` — the selected candidate cannot be proved or tested because required staging infrastructure, identity, fixtures or review evidence is unavailable.

Both `FAILED` and `BLOCKED` fail the GitHub Actions release gate. A critical test that requires retry is not treated as a clean PASS.

## Evidence

Each run retains a sanitized artifact containing applicable evidence such as:

- source SHA and deployment run ID;
- web/worker image IDs and immutable digests;
- rollback release reference;
- host/runtime acceptance JSON;
- customer/Studio/media evidence;
- public and synthetic-QA screenshots;
- visual hashes;
- per-area PASS/FAIL/BLOCKED results and test counts;
- final JSON, Markdown and HTML certification reports.

Artifacts are retained for 30 days by the workflow. Secret-bearing environment dumps, raw auth headers, cookies, payment credentials and unsafe network traces are prohibited.

## Protected staging inputs

Existing deployment inputs remain under the protected GitHub `staging` environment: DigitalOcean, SSH, Cloudflare/R2, Supabase/PostgreSQL, SMTP, backup, operations and other server-only deployment values.

Certification additionally uses the already protected Supabase publishable/service credentials plus deterministic synthetic QA email identities. Default synthetic addresses exist in the workflow and can be overridden by environment variables:

- `STAGING_QA_CUSTOMER_EMAIL`
- `STAGING_QA_ADMIN_EMAIL`
- `STAGING_QA_RESTRICTED_EMAIL`
- `STAGING_QA_UNAUTHORIZED_EMAIL`

Optional visual review controls:

- `STAGING_VISUAL_REVIEW_ACCEPTED`
- `STAGING_VISUAL_REVIEW_ACCEPTANCE_REFERENCE`

Do not put passwords, access tokens or private keys into issues, chat or repository files.

## Human UAT and production

Human UAT starts only after `READY FOR UAT` and remains an explicit manual approval focused on UX, usability, copy/content, visual quality, mobile experience, exploratory scenarios and business acceptance.

Production requires separate explicit approval. Promotion must use the exact immutable artifacts proven in staging/UAT; production smoke must be non-destructive and preserve rollback evidence. This certification workflow contains no production deployment action.

## Permanent feature rule

A feature is complete only when the relevant automated coverage lands with it: unit/API tests, browser happy path, negative/error cases, authorization tests, Studio coverage when operationally relevant, payment coverage when relevant, and mobile/responsive coverage when relevant. Every QA/UAT defect must add a permanent regression test so the staging suite grows with the product.
