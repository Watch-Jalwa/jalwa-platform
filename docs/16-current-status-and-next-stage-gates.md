# Current Status and Next-Stage Gates

**Audit date:** 31 July 2026  
**Repository:** `Watch-Jalwa/jalwa-platform`  
**Primary branch:** `main`

This document is the current operational source of truth. Earlier roadmap documents explain the intended product; this document distinguishes implemented repository capability from live-environment evidence.

## Executive status

The repository-side application and release system are mature enough to begin controlled content onboarding and isolated staging activation. The codebase is not yet a live commercial service.

- Frontend builds are available through Vercel.
- The full transactional stack is designed to run on isolated DigitalOcean infrastructure with self-hosted Supabase services, Cloudflare R2 and the media gateway.
- Staging and production workflows are intentionally manual and fail closed when required values are absent.
- Production billing, live streaming and web DRM remain disabled until their provider and acceptance gates are complete.
- The approved delivery model is mobile-first responsive web/PWA only; native Android/iOS apps and app-store distribution are out of current scope.
- The only enduring launch tracker should be the live activation issue; completed implementation issues should remain closed.

## Implemented repository capabilities

### Consumer product

- responsive PWA shell and mobile navigation;
- Urdu/RTL-ready layout foundation;
- catalogue, categories, search, home rows and content pages;
- official YouTube embed playback;
- self-hosted MP4 and HLS playback with signed access;
- Shorts feed, watch history, profiles, devices, notifications and offline/PWA surfaces;
- legal and support pages.

### Studio and content governance

- draft creation and official YouTube URL import;
- governed batch catalogue intake;
- source, rights, attribution, evidence, expiry and takedown records;
- publication blocked unless current mode-compatible rights evidence is complete;
- immediate unpublish/takedown controls;
- moderation, support and operations workspaces;
- media upload completion and background-processing paths.

### Identity, privacy and trust

- Supabase SSR authentication scaffold;
- profiles and role/capability checks;
- account data export and deletion processing;
- protected diagnostics;
- CSP reporting and bounded browser/server error collection;
- audit records for privileged and finance-sensitive operations.

### Payments and Premium

- plans and prices;
- checkout orders and payment attempts;
- provider adapter boundary and signed webhook verification;
- normalized activation, renewal, refund, reversal, dispute and failure states;
- idempotent event processing and conflicting-replay rejection;
- subscriptions and entitlements;
- cancellation-at-period-end and renewal consent fields;
- operational finance exception handling;
- authoritative Premium summary, payment ledger, subscription ledger, recurring-customer, reconciliation and benefit-support reports;
- backend-owned Karachi-time formulas, MRR/ARR definitions, audited UTF-8 CSV exports and separate read/export capabilities.

### AI

- server-side OpenAI-compatible provider gateway;
- catalogue-grounded responses and citation filtering;
- provider moderation and hard safety checks;
- free and Premium usage limits;
- prompts/evaluation assets held in version control.

### Release engineering

- forward-only migration inventory and clean-database migration validation;
- exact lockfile installation and production dependency audit;
- CycloneDX SBOM generation;
- production web and worker image builds;
- fixable high/critical image vulnerability rejection;
- production image runtime contracts and web-container boot acceptance;
- desktop/mobile Chromium journeys;
- immutable commit-SHA deployment images;
- pre-migration encrypted off-site backup;
- restore-drill verification;
- transactional application rollback that restores image and reported version together;
- protected readiness and release-correlated diagnostics;
- isolated Terraform state, host, DNS and `jalwa-staging-*` R2 resources for staging.

## Repository gate status

| Gate | Status | Evidence boundary |
|---|---|---|
| Lint and strict type checking | Complete | GitHub CI |
| Web and worker tests | Complete | GitHub CI |
| Migration application and privilege checks | Complete | clean CI PostgreSQL service |
| Production dependency audit | Complete | `npm audit --omit=dev --audit-level=high` |
| SBOM | Complete | CycloneDX generated in CI |
| Web/worker image build | Complete | GitHub CI |
| Fixable high/critical image scan | Complete | CI vulnerability policy |
| Production container boot | Complete | CI container acceptance |
| Desktop/mobile browser journeys | Complete | pinned Chromium harness |
| Release rollback contract | Complete | automated release tests |
| Backup encryption contract | Complete | automated age tests |
| Premium reporting security/fixtures | Complete | tests and staging acceptance workflow |
| Vercel frontend build | Complete | frontend preview/build evidence only |
| Isolated live staging | Blocked externally | environment variables, secrets, accounts, DNS and host required |
| Real merchant payment provider | Blocked externally | commercial onboarding and credentials required |
| Production deployment | Not started | requires live staging and production approval |
| Launch catalogue | Not started | rights-cleared source and editorial work required |
| Native app-store submission | Out of scope | approved product is mobile-first responsive web/PWA only |

## External staging activation requirements

The GitHub `staging` environment must contain valid, non-example values for:

- DigitalOcean host/user, SSH private key and pinned known-host entry;
- staging domain and DNS;
- GHCR deployment credentials;
- pinned self-hosted Supabase Docker reference;
- generated PostgreSQL, JWT, anon, service-role, dashboard, vault, metadata, log and pooler secrets;
- Cloudflare account/token and isolated incoming, processed and backup R2 buckets;
- media-signing and application-operation secrets;
- SMTP credentials and sender identity;
- AI provider key and operational quotas;
- observability destination;
- staging mock-payment webhook secret;
- age identity for encrypted backups.

Do not copy production values into staging. Staging must remain independently revocable and use `jalwa-staging-*` storage resources.

## Live staging completion sequence

1. Run **Bootstrap staging** from the latest green `main` commit when the host and DNS do not yet exist.
2. Independently verify the provisioned host address and Ed25519 fingerprint before storing the known-host entry.
3. Run **Deploy staging** from `main`.
4. Confirm readiness reports the exact deployed commit SHA.
5. Confirm web, worker, proxy, database, Auth and REST health checks.
6. Confirm pre-migration and post-deployment encrypted backups, then run the restore drill.
7. Run the automatic staging release acceptance with zero-content infrastructure expectations.
8. Create or import at least one authorised catalogue item, complete rights evidence and publish it.
9. Run staging acceptance with minimum published content `1`.
10. Exercise sign-up, verification, login, renewal, password reset, profile/device controls, account export/deletion, playback, PWA behaviour, mock checkout, refunds/reconciliation and Premium finance screens.
11. Retain workflow artifacts and human acceptance notes against the exact release SHA.

## Production blockers

Production remains blocked until all of the following are true:

- live staging evidence is complete for the same release family;
- domain, DNS, SSH, GHCR, R2, Supabase, SMTP, AI and observability production values are configured;
- one Pakistan-compatible hosted payment provider is contractually active and tested with signed success, failure, refund, dispute and conflicting replay events;
- pricing, refund/cancellation wording, support ownership and finance reconciliation ownership are approved;
- every launch item has source, rights, attribution, review, expiry and takedown evidence;
- support, privacy, terms, moderation, incident and takedown processes have named owners;
- launch-day monitoring, rollback and stop-launch authority are rehearsed;
- the production workflow produces immutable manifests, SBOM/provenance and host-acceptance evidence;
- production readiness reports the exact deployed SHA and backups/restore evidence is retained.

## Product delivery boundary

The approved product is a mobile-first responsive browser application and installable PWA. Native Android and iOS applications, Google Play distribution and Apple App Store distribution are not current deliverables, deployment gates or launch blockers.

Acceptance must still cover representative Android and iOS browsers, responsive layouts, PWA installability, constrained-network behaviour, playback and hosted checkout. Do not create native/store issues or packaging work unless the owner explicitly changes the product direction in a future decision.

## Issue policy from this point

- Keep one live activation issue for external staging/production evidence.
- Use the content-source form for each proposed source programme or rights-holder.
- Use a release-blocker issue for a failed live gate tied to an exact SHA.
- Use feature/bug forms for scoped repository work.
- Close superseded Dependabot major-upgrade PRs; major upgrades require a dedicated compatibility issue.
- Do not reopen completed implementation issues merely to track external configuration.
