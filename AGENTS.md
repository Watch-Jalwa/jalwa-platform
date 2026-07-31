# Jalwa Agent Guide

## Mission

Build and operate a mobile-first Pakistani content platform with rights-aware playback, paid entitlements, auditable finance operations and catalogue-grounded AI.

## Operating rules

- Read `README.md`, `CONTRIBUTING.md` and the relevant `docs/` file before changing a domain.
- Start from the latest green `main` commit and use a short-lived branch.
- Keep one modular monolith until measured operational evidence requires separation.
- Never self-host media without an approved rights record and retained evidence.
- Never download YouTube media; official embeds only.
- Never activate Premium from a browser return URL, screenshot or unverified support claim.
- Keep payment processing authenticated, normalized, idempotent, replay-safe and auditable.
- Keep Urdu, RTL, accessibility, mobile and low-data behaviour in acceptance criteria.
- Keep prompts, model configuration and evaluations in version control.
- Add tests for business rules, permissions, privacy, payment, rights and deployment boundaries.
- Never expose service-role, payment, AI, media, database or deployment secrets to client components.
- Every privileged mutation and finance export must be auditable.
- Keep GitHub Actions pinned to full commit SHAs and deployment images pinned to immutable commit SHAs.
- Treat Vercel as frontend preview/build evidence, not full-stack staging or production evidence.
- Do not declare staging or production complete without live health, migration, backup and browser acceptance evidence.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:release
npm run test:backup-encryption
npm run build
```

GitHub Actions additionally validates migrations, infrastructure, production dependency audit, CycloneDX SBOM, container vulnerability policy, runtime image contracts, production boot and Chromium journeys.

## Change completion

A change is not complete until:

- the implementation and tests are committed;
- documentation and operational notes are current;
- permissions and error states are covered;
- content-rights and privacy effects are explicit;
- the pull request is green and reviewable;
- the exact validated head is merged without bypassing release controls.
