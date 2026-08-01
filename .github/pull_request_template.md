## Problem and user impact

## Solution and trade-offs

## Screenshots or recordings

<!-- Required for user-interface changes. Include mobile evidence and redact sensitive data. -->

## Data, API and migrations

<!-- Include compatibility, backfill and forward-recovery notes. Never rewrite applied migrations. -->

## Security, privacy and authorization

<!-- Describe server-side capability checks, sensitive data handling, request bounds, audit and secret exposure. -->

## Content rights and editorial impact

<!-- Source, licence, attribution, evidence, territory, expiry, takedown and specialist review. -->

## Payments, entitlements and finance

<!-- Provider/webhook/idempotency/reconciliation/reporting impact. Never activate from browser return state. -->

## AI prompt, model and evaluation impact

<!-- State prompt version, model/provider configuration, retrieval/tool changes, eval-set changes, safety/leakage results, cost/latency impact and rollback. -->

## Analytics, observability and support impact

## Test evidence

<!-- List local commands and relevant targeted scenarios. GitHub CI remains authoritative for the full release gate. -->

## Rollout, rollback or roll-forward

## Linked issue or maintenance rationale

## Checklist

- [ ] Branch started from a current green `main` commit
- [ ] Change is scoped; dependency and formatting churn is intentional
- [ ] Mobile and low-data behaviour checked
- [ ] Urdu/RTL and accessibility checked
- [ ] Server-side permissions and audit behaviour checked
- [ ] Error, empty, loading and partial-failure states handled
- [ ] Tests added or updated for business/security rules
- [ ] Data/API compatibility and migration recovery documented
- [ ] Source, licence, attribution and takedown metadata preserved where relevant
- [ ] Payment/entitlement changes rely on verified server-side state
- [ ] AI behaviour changes use a new prompt version and updated evaluation cases
- [ ] Retrieved content/tool output is treated as untrusted data
- [ ] AI write tools require explicit intent, authorization, bounded arguments and audit evidence
- [ ] No secrets, customer data or private provider payloads included
- [ ] Documentation and operations notes updated
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, release/backup tests and build pass, or exceptions are explained above
- [ ] `npm run test:ai` and exact-configuration staging eval evidence are included for relevant AI changes
- [ ] Vercel preview success is not presented as full-stack staging or production evidence
