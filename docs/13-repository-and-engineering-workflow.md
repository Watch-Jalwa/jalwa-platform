# Repository and Engineering Workflow

## Repository model

`Watch-Jalwa/jalwa-platform` is the private primary repository. It remains a monorepo so UI, server routes, worker logic, prompts, evaluations, migrations, infrastructure, tests and operational documentation can change atomically.

Create a separate repository only when access separation, independent release cadence or ownership boundaries are proven operational requirements.

## Branch policy

- `main` is the release branch;
- start from the latest green `main` commit;
- use short-lived branches;
- normal changes require a pull request;
- merge the exact validated head SHA;
- prefer squash merge for coherent history;
- delete merged branches;
- do not bypass required checks or environment protections;
- document emergency changes and follow them with normal review/evidence.

Vercel previews are frontend evidence only. Staging and production promotion use protected full-stack workflows.

## Issue intake

Use the structured forms under `.github/ISSUE_TEMPLATE/` for reproducible bugs, scoped features, content-source review and exact-SHA release blockers. Vulnerabilities use private security advisories.

Every implementation issue should include:

- user outcome, limitation, constraints and non-goals;
- observable acceptance criteria;
- data/API/migration impact;
- security, privacy and permission impact;
- content-rights and editorial impact;
- payment/finance impact;
- AI prompt/model/provider/retrieval/tool/evaluation impact;
- analytics, observability and support impact;
- tests and rollout/rollback plan.

Do not use completed implementation issues to track unrelated external configuration.

## Pull request requirements

Every pull request must explain problem, solution, compatibility, permissions, privacy, rights, payments, AI impact, observability, tests and rollback. UI work includes mobile evidence. AI work includes prompt version, eval revision, safety/leakage results and exact-configuration staging evidence when behaviour changes.

## Required validation

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:release
npm run test:backup-encryption
npm run build
```

For AI changes:

```bash
npm run test:ai
```

GitHub CI additionally validates infrastructure, dependency tree/audit, CycloneDX SBOM, clean migrations and privileges, production images, vulnerability policy, runtime contracts, container boot and Chromium journeys.

## AI-native engineering

AI agents may plan, implement, test, review and document scoped work, but repository policy and human approval remain authoritative.

The AI development baseline is:

- prompt registry: `apps/web/lib/ai/prompts.mjs`;
- synthetic evals: `evals/`;
- provider adapter boundary: `apps/web/lib/ai/openai.ts`;
- access-filtered retrieval and citation validation;
- model/provider configuration through environment values;
- exact prompt/model/source/token audit records.

Rules:

- new prompt behaviour requires a new immutable prompt version;
- retrieved content and tool output are untrusted data;
- provider-specific request shapes remain inside adapters;
- read tools respect the current user's access;
- write tools require intent, authorization, validation, audit and rollback/compensation;
- no customer conversations, private rights evidence or secrets in eval fixtures;
- deterministic tests are necessary but not sufficient; live staging evals are required before promotion;
- never invent successful staging/production or eval evidence.

Human review remains required for production promotion, provider activation, rights approval and external account configuration.

## Context files

Keep current:

- `README.md`;
- `AGENTS.md`;
- `CONTRIBUTING.md`;
- `SECURITY.md`;
- architecture/data/media/payment/security/AI documents;
- current status and deployment handoff;
- launch runbook;
- prompt registry and evaluation sets;
- [AI-native development readiness](26-ai-native-development-readiness.md).

## Dependencies

- routine patch/minor updates may be grouped by Dependabot;
- major updates need a dedicated compatibility issue and migration plan;
- dependency-only PRs pass full CI;
- GitHub Actions remain pinned to full commit SHAs;
- deployment images use immutable commit-SHA identifiers;
- lockfile changes remain isolated and intentional.

## Migrations

Migrations are forward-only, ordered and never rewritten after application. Prefer additive schema changes, compatible rollout, backfill before constraints and separate destructive cleanup. Include recovery notes and verify privileges in clean CI PostgreSQL.

## Environments and secrets

- protected environments: `staging` and `production`;
- use dedicated accounts/credentials for each;
- keep service-role, payment, AI, media and deployment credentials server-side;
- verify SSH fingerprints independently;
- rotate uncertain credentials;
- never place customer/provider data in commits, prompts, logs or eval fixtures.

## Release workflow

1. merge a reviewed green PR;
2. confirm the exact `main` SHA;
3. deploy isolated staging;
4. retain health, migration, backup/restore, browser, transaction and relevant AI-eval evidence;
5. approve production promotion;
6. deploy immutable images;
7. verify exact SHA, services, queues, backups and provider reconciliation;
8. monitor and roll forward or use tested rollback;
9. record the release and follow-up.

## Development restart

Unrelated feature work remains paused while deployment and manual acceptance are pending. After the go/no-go record, create new issues from actual tester/operational evidence and apply the same repository, security, rights, payment and AI-native gates.
