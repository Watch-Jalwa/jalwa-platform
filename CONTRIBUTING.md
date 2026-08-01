# Contributing to Jalwa

Jalwa is a private, pre-launch product with security, payment, privacy and content-rights boundaries. Changes should be small, reviewable and backed by evidence.

## Before starting

1. Read `AGENTS.md` and the relevant domain document under `docs/`.
2. Confirm the issue describes the user outcome, constraints, acceptance criteria, non-goals, data impact, security/privacy impact, content-rights impact, tests and observability.
3. Start from the latest green `main` commit.
4. Use a short-lived branch such as `feat/catalogue-import`, `fix/payment-replay` or `chore/release-docs`.

Do not commit directly to `main` for normal work.

## Branch lifecycle

- Keep feature, fix, chore, documentation and agent branches short-lived.
- Delete a branch after its work is merged unless it is an intentional environment, release, hotfix or backup branch.
- The `Cleanup merged branches` workflow may delete branches whose current head is fully merged into `main`, exactly matches a merged pull request to `main`, or exactly matches a closed pull request explicitly documented as superseded by replacement work.
- The workflow never deletes a branch with an open pull request or an unexplained unmerged head.
- `backup/*` branches are retained unless an owner explicitly approves removal.
- Do not use old merged or superseded branches as the base for new work; start from the current green `main`.

## Local setup

Use the versions declared by the repository.

```bash
npm ci
npm run dev
```

Do not use `npm install` merely to refresh the lockfile. Dependency and lockfile changes must be intentional and isolated.

## Required validation

Run the relevant targeted tests while developing. Before requesting review, run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:release
npm run test:backup-encryption
npm run build
```

Changes to Docker, production runtime, media processing or deployment scripts must also pass the container and browser jobs in GitHub Actions. Changes to migrations must apply successfully against a clean PostgreSQL database in filename order.

## Pull requests

Every pull request must explain:

- the problem and user impact;
- the solution and important trade-offs;
- screenshots or recordings for user-interface changes;
- schema, API, migration and compatibility impact;
- security and privacy impact;
- content source, licence, attribution and takedown impact;
- payment, entitlement or finance impact;
- AI prompt, model, quota, moderation or evaluation impact;
- analytics and observability changes;
- tests performed;
- rollback or roll-forward plan;
- linked issue or explicit maintenance rationale.

Keep generated files, dependency changes and unrelated formatting out of feature pull requests.

## Security and privacy rules

- Never place secrets, production identifiers, customer data or provider payloads in commits, issues, logs or screenshots.
- Server-side authorization is required for every privileged read, export and mutation; hiding a button is not authorization.
- Every privileged mutation and financial export must remain auditable.
- Keep service-role, database, media, AI, payment and deployment credentials server-side.
- Use bounded request bodies, deterministic idempotency and signed webhook verification on external event paths.
- Follow `SECURITY.md` for vulnerability reports.

## Content and media rules

- Never download or mirror YouTube media. Use official embeds.
- Never self-host a file without an approved rights record covering the intended territory, duration and commercial use.
- Preserve source URL, creator, licence, attribution text, evidence, review owner, expiry and takedown owner.
- Automated imports may create drafts only; publication remains a human approval step.
- Do not place externally embedded content behind a paid access gate unless the provider terms and written rights explicitly allow it.

## Payments and subscriptions

- Never store card details.
- Never activate access from a browser return URL, screenshot or unverified support claim.
- Provider webhooks must be authenticated, normalized, idempotent and replay-safe.
- Entitlements are controlled by verified server-side payment state.
- Production mock payments are forbidden.

## Migrations

- Migrations are forward-only and ordered.
- Prefer additive schema changes, backfill data, then add constraints.
- Separate destructive cleanup into a later release after compatibility has been proven.
- Do not rewrite an applied migration.
- Include rollback or operational recovery notes even when the database migration itself is forward-only.

## Dependencies

Routine Dependabot patch/minor updates may be merged only after the full CI pipeline passes. Major upgrades require a dedicated issue, compatibility review and migration plan. The repository intentionally ignores unsolicited major-version Dependabot PRs.

GitHub Actions must remain pinned to full commit SHAs. Container images and deployment artifacts must use immutable identifiers.

## Releases

The release order is:

1. merge a reviewed, green pull request into `main`;
2. confirm the exact `main` commit is green;
3. deploy the isolated staging environment;
4. retain staging health, migration, backup, browser and transactional acceptance evidence;
5. approve production promotion;
6. deploy immutable images and run post-deployment acceptance;
7. monitor, then roll forward or use the tested transactional rollback path.

Vercel preview success alone is not a staging or production release.
