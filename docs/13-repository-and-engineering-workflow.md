# Repository and Engineering Workflow

## Repository model

`Watch-Jalwa/jalwa-platform` is the private primary repository. It remains a monorepo so UI, server routes, worker logic, migrations, infrastructure, tests and operational documentation can change atomically.

Create a separate repository only when access separation, independent release cadence or ownership boundaries are proven operational requirements.

## Branch policy

- `main` is the release branch;
- start from the latest green `main` commit;
- use short-lived branches such as `feat/catalogue-search`, `fix/payment-replay` or `chore/release-docs`;
- normal changes require a pull request;
- merge the exact validated head SHA;
- prefer squash merge for a coherent main history;
- delete merged branches;
- do not bypass required checks or environment protections;
- document emergency changes and follow them with normal review/evidence.

Vercel previews are frontend evidence only. Staging and production promotion use the protected full-stack workflows.

## Issue intake

Use the structured forms under `.github/ISSUE_TEMPLATE/`:

- bug report for reproducible defects;
- feature request for scoped product/platform work;
- content-source review for rights and editorial approval;
- release blocker for failed live gates tied to an exact SHA;
- private security advisory for vulnerabilities.

Every implementation issue should include:

- user outcome and current limitation;
- constraints and non-goals;
- observable acceptance criteria;
- data/API/migration impact;
- security, privacy and permission impact;
- content-rights and editorial impact;
- payment/finance impact when applicable;
- AI prompt/model/quota/moderation impact when applicable;
- analytics, observability and support impact;
- tests and rollout/rollback plan.

Do not use completed implementation issues to track unrelated external configuration. Keep live activation evidence in the dedicated activation issue or a release-blocker issue.

## Pull request requirements

Every pull request must explain:

- problem and user impact;
- solution and trade-offs;
- screenshots/recording for UI work;
- schema, migration, API and compatibility impact;
- security/privacy and authorization impact;
- content source/licence/attribution/takedown impact;
- payment, entitlement and finance impact;
- AI prompt/model/evaluation impact;
- analytics and observability;
- test plan and results;
- rollback or roll-forward plan;
- linked issue or maintenance rationale.

The repository CODEOWNERS file assigns current ownership. Additional reviewers/teams should be added when real domain owners exist.

## Required validation

Local pre-review checks:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:release
npm run test:backup-encryption
npm run build
```

GitHub CI additionally performs:

- Terraform formatting and static production validation;
- exact locked dependency installation and dependency-tree verification;
- production dependency audit;
- CycloneDX SBOM generation;
- clean PostgreSQL migration application and privilege checks;
- production web/worker image builds;
- fixable high/critical image vulnerability rejection;
- runtime image contract verification;
- production web-container boot test;
- pinned Chromium desktop/mobile journeys.

Media changes should use generated/small fixtures and must not commit large copyrighted media.

## Dependency policy

- routine patch/minor updates may be grouped by Dependabot;
- major updates are ignored by routine automation;
- a major runtime/framework/toolchain upgrade requires a dedicated compatibility issue and migration plan;
- dependency-only PRs must pass the full CI pipeline;
- GitHub Actions remain pinned to full commit SHAs;
- container and release images remain immutable;
- lockfile changes must be isolated and intentional;
- do not label every version update as a security fix.

## AI-assisted engineering

AI agents may plan, implement, test, review and document scoped work, but the repository rules remain authoritative.

Agent work must:

- read relevant repository documentation first;
- use current code and issue evidence rather than assumptions;
- preserve security, privacy, payment and rights boundaries;
- add/adjust tests with implementation;
- keep changes scoped;
- update docs and operational evidence;
- never invent successful staging/production execution;
- never place secrets or customer/provider data in prompts, commits or logs.

Human review is required for production promotion, provider activation, rights approval and external account configuration.

## Context files

Keep these current:

- `README.md` — repository overview and status;
- `AGENTS.md` — agent operating rules;
- `CONTRIBUTING.md` — contributor workflow;
- `SECURITY.md` — private vulnerability reporting;
- architecture/data/media/payment/security documents;
- current status and release gates;
- content/commerce/deployment handoff;
- launch runbook;
- prompts and evaluations.

## Migrations

- migrations are forward-only and ordered;
- never rewrite an applied migration;
- prefer additive schema changes;
- backfill before adding restrictive constraints;
- deploy code compatible with old and new schema where a rolling boundary exists;
- separate destructive cleanup into a later release;
- include recovery/roll-forward notes;
- verify privileges and service-role-only functions in clean CI PostgreSQL.

## Environments and secrets

- GitHub environments: `staging` and `production`;
- use dedicated provider accounts/credentials for each environment;
- staging resources must be independently revocable and clearly prefixed;
- production deployment requires explicit approval;
- never commit secret values or real customer/provider payloads;
- rotate leaked or uncertain credentials immediately;
- pin SSH known-host entries and verify fingerprints independently;
- keep service-role, payment, AI, media and deployment credentials server-side;
- encrypted backup identity and storage access are high-risk production boundaries.

## Release workflow

1. merge a reviewed, green pull request into `main`;
2. confirm the exact `main` SHA is green;
3. deploy isolated staging;
4. retain health, migration, backup/restore, API, browser and transactional evidence;
5. approve production promotion;
6. deploy immutable production images;
7. verify exact readiness SHA, services, queues, backups and provider reconciliation;
8. monitor;
9. roll forward or use the tested transactional rollback;
10. record the release and outstanding follow-up.

## Current ownership and access

The connected GitHub application has administrator access to the private repository for code, pull request and issue maintenance. External account configuration, environment secrets, provider onboarding, DNS/account ownership and live human acceptance remain owner-controlled actions and must not be represented as completed without retained evidence.
