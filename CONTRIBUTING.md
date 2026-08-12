# Contributing to Jalwa

Jalwa is a private, pre-launch product with security, payment, privacy, content-rights and AI-safety boundaries. Changes should be small, reviewable and backed by evidence.

## Before starting

1. Read `AGENTS.md` and the relevant domain document under `docs/`.
2. Confirm the issue describes the user outcome, constraints, acceptance criteria, non-goals, data impact, security/privacy impact, content-rights impact, AI impact, tests and observability.
3. Start from the latest green `main` commit.
4. Use a short-lived branch such as `feat/catalogue-import`, `fix/payment-replay` or `chore/release-docs`.

Do not commit directly to `main` for normal work.

## Branch lifecycle

- Keep feature, fix, chore, documentation and agent branches short-lived.
- Delete a branch after its work is merged unless it is an intentional environment, release, hotfix or backup branch.
- The `Cleanup merged branches` workflow may delete branches whose current head is fully merged into `main`, exactly matches a merged pull request to `main`, or exactly matches a closed pull request explicitly documented as superseded by replacement work.
- A branch matching `agent/*-test` may also be removed when its only unique file is the explicit `tmp-do-not-merge.txt` test marker.
- The workflow never deletes a branch with an open pull request or an otherwise unexplained unmerged head.
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

AI prompt, model, provider, retrieval, moderation or tool changes must also run:

```bash
npm run test:ai
```

Changes to Docker, production runtime, media processing or deployment scripts must pass the container and browser jobs in GitHub Actions. Changes to migrations must apply successfully against a clean PostgreSQL database in filename order.

## Permanent feature-completion rule

A feature is not complete only because its UI or API implementation works locally. Every change must add the automated coverage appropriate to its risk and product surface:

- unit and API/contract tests for business logic and server boundaries;
- browser happy-path coverage for user-visible critical journeys;
- negative/error tests for invalid input, stale state, retries and dependency failure where relevant;
- authorization tests for protected reads and mutations;
- Studio/admin coverage when an operational workflow changes;
- payment/idempotency/replay coverage when commerce changes;
- mobile/responsive coverage when a customer-facing journey changes.

A bug found during automated QA, staging certification or human UAT must gain a permanent regression test as part of the fix whenever the failure can be automated safely. Do not reset the release suite to manual spot checks on the next release.

The exact deployed staging release must pass the permanent certification described in `docs/27-staging-certification.md` before it can be labelled `READY FOR UAT`.

## Pull requests

Every pull request must explain:

- the problem and user impact;
- the solution and important trade-offs;
- screenshots or recordings for user-interface changes;
- schema, API, migration and compatibility impact;
- security and privacy impact;
- content source, licence, attribution and takedown impact;
- payment, entitlement or finance impact;
- AI prompt, model, provider, retrieval, quota, moderation, tool and evaluation impact;
- analytics and observability changes;
- tests performed;
- rollback or roll-forward plan;
- linked issue or explicit maintenance rationale.

Keep generated files, dependency changes and unrelated formatting out of feature pull requests.

## AI-native development

- Prompt definitions and versions live in `apps/web/lib/ai/prompts.mjs`; do not hide production prompts in route handlers or deployment workflows.
- Synthetic evaluation cases live under `evals/`; do not add customer conversations or private operational data.
- Every behaviour-changing prompt edit requires a new prompt version and updated eval cases.
- Provider and model identifiers remain environment configuration. Product logic must not depend on one provider's response shape outside the adapter boundary.
- Retrieved catalogue text, metadata and tool output are untrusted data. Prompts and code must resist instructions embedded inside them.
- Read tools may be automatic only when access-filtered. Write tools require explicit user intent, server authorization, bounded arguments and audit evidence.
- Before production promotion, run a live staging evaluation against the exact prompt, model, provider, retrieval configuration and release SHA; retain language, citation, safety, leakage, latency and cost evidence.
- OpenAI-specific agentic/tooling work should use the current supported Responses/structured-output path inside an adapter rather than spreading provider-specific requests through product code.

## Security and privacy rules

- Never place secrets, production identifiers, customer data or provider payloads in commits, issues, logs, screenshots, prompts or eval fixtures.
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

GitHub Actions must remain pinned to full commit SHAs. Deployment artifacts must use immutable commit-SHA identifiers.

## Releases

The release order is:

1. merge a reviewed, green pull request into `main`;
2. confirm the exact `main` commit is green;
3. deploy immutable web/worker images into the isolated staging environment;
4. prove `source SHA → deployment run → image digest → running image ID/OCI revision` and retain rollback identity;
5. run the automatic staging certification for runtime/API, browser, Premium checkout/payment, Studio authorization, media/catalogue, mobile purchase and visual evidence;
6. proceed only when the machine-verifiable decision is `READY FOR UAT`;
7. complete explicit human UAT and retain the approval;
8. explicitly approve production promotion;
9. promote the exact tested immutable artifacts rather than rebuilding a different release;
10. run non-destructive production smoke, monitor, then roll forward or use the tested rollback path.

`FAILED` and `BLOCKED` staging certification both block UAT. Human UAT never automatically deploys production. Vercel preview success alone is not staging certification or a production release.
