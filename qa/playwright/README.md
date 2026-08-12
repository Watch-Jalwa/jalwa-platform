# Jalwa staging Playwright suite

This suite is the reusable browser-test layer for the protected transactional staging environment. It complements the release-certification orchestrator in `.github/workflows/staging-acceptance.yml`; the orchestrator remains authoritative for the final `READY FOR UAT`, `FAILED` or `BLOCKED` decision.

## Coverage

| Spec | Coverage |
| --- | --- |
| `public.spec.mjs` | home/explore/search, exact release health, staging `noindex`, login/signup validation, legal pages, readiness, CSP report endpoint, manifest, mobile navigation and responsive overflow |
| `auth.spec.mjs` | real email magic-link request boundary, generated staging magic-link session, authenticated session persistence, invalid email rejection |
| `customer.spec.mjs` | anonymous checkout denial, missing/invalid price rejection, duplicate-submit idempotency, authoritative price/currency, mock payment completion, succeeded order, active subscription, exact entitlements, full Mobile Chromium purchase |
| `studio.spec.mjs` | anonymous denial, admin Studio surfaces, `rights_reviewer` least privilege, viewer denial, Finance reporting sections, filters, pagination, empty/error states, CSV safety, audit linkage and mobile report layout |
| `media.spec.mjs` | real published catalogue/watch boundary, media-or-safe-unavailable rendering, same-origin/browser failures, governed live catalogue, official-link-only no-iframe boundary and allowlisted live-image routes |
| `visual.spec.mjs` | deterministic public screenshots for home, explore, pricing and login against the human-approved SHA-256 manifest |

Generic restaurant cart, delivery/take-away, dispatcher-branch and native-mobile scenarios are not Jalwa product capabilities and are intentionally not fabricated as Playwright coverage.

## Protected inputs

Never commit credentials. Supply them from the GitHub `staging` environment or a local secret manager.

Common runtime inputs:

- `STAGING_BASE_URL`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `RELEASE_SHA` or `JALWA_EXPECTED_VERSION`

Synthetic QA identities:

- `STAGING_QA_CUSTOMER_EMAIL`
- `STAGING_QA_ADMIN_EMAIL`
- `STAGING_QA_RESTRICTED_EMAIL`
- `STAGING_QA_UNAUTHORIZED_EMAIL`
- `STAGING_QA_FINANCE_EMAIL` or existing `FINANCE_EMAIL`
- `STAGING_QA_REPORT_VIEWER_EMAIL` or existing `VIEWER_EMAIL`

Feature controls:

- `ALLOW_MOCK_PAYMENTS=true` for the current isolated staging payment provider
- `JALWA_EXPECT_LIVE_SOURCES=true` only when the governed live catalogue is enabled for that staging run
- `VISUAL_BASELINE_MANIFEST` only when overriding `qa/visual-baselines/manifest.json`

The current product uses email magic-link authentication. The tests therefore do not store or require account passwords: they prove the user-facing email-link request and use the protected Supabase admin boundary to generate deterministic QA magic links for authenticated test setup.

## Install the pinned browser harness

The staging GitHub workflow already installs the pinned browser harness. For an equivalent local shell:

```bash
npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @playwright/test@1.61.1 @supabase/supabase-js@2.111.0
npx playwright install --with-deps chromium
```

## Run

```bash
npm run test:staging:playwright
npm run test:staging:playwright:public
npm run test:staging:playwright:customer
npm run test:staging:playwright:studio
npm run test:staging:playwright:media
npm run test:staging:playwright:visual
```

The Playwright config forces one worker because checkout, role assignment and reporting fixtures are intentionally stateful staging scenarios. Trace and video are disabled so authenticated/payment-sensitive browser state is not retained. Failure screenshots, HTML output and JUnit output are written under the configured test-results/report directories.

`visual.spec.mjs` fails with `VISUAL REVIEW REQUIRED` when a baseline is absent or changed. CI never approves or rewrites visual baselines automatically; the release-certification workflow handles the special review state and exact-release approval separately.
