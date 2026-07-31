# Jalwa Premium Phase 1 reporting

Jalwa Premium reporting is part of the existing Jalwa Studio admin application. The operational queue remains at `/studio/finance`; the reporting workspace begins at `/studio/finance/reports`.

## Architecture

- PostgreSQL stores immutable payment purpose, plan and price snapshots, lifecycle timestamps, refund facts and subscription status history.
- `apps/web/lib/reports/premium.mjs` owns date boundaries, formulas, recurring-customer rules, MRR normalization and CSV escaping.
- `apps/web/lib/studio/premium-reports.ts` is the server-only reporting facade. Studio pages and API routes consume the same report services.
- JSON contracts are available below `/api/studio/premium-reports/[report]`.
- CSV exports are generated below `/api/studio/premium-reports/export/[report]` and use identical filters and formulas.
- Finance totals are never reconstructed from the currently visible table rows.

## Report sections

- Summary: collections, refunds, net cash, attempts, activations, renewals, active subscriptions, recurring customers, MRR and ARR.
- Payment ledger: paginated safe payment facts and reconciliation state.
- Subscription ledger: lifecycle dates, paid/manual origin, renewal counts and lifetime collected revenue.
- Recurring customers: completed renewals, consent-only users, failed renewals, approaching renewal and grace/past-due users.
- Reconciliation: read-only payment exceptions, failed webhooks, stale pending payments, failed renewals, refund mismatches and paid subscriptions without completed payments.
- Benefit costs: explicitly unsupported until an approved monetary benefit ledger exists.

## Definitions

- Collected cash and MRR are separate. MRR is a normalized run-rate and does not represent cash received in the selected date range.
- A recurring customer requires at least one completed renewal. Auto-renew consent alone is never counted as recurring.
- Activation and renewal are stored on each checkout order. Existing historical orders are preserved as `unknown`; the migration does not fabricate renewal history.
- Gross collections include captured successful payments before refunds. Net collections subtract authoritative full and partial refund records.
- Failed attempts are not automatically counted as churn or lost subscribers.
- Monthly plans contribute their monthly amount to MRR. Annual plans contribute one twelfth. Passes and manual grants contribute zero.
- Historical subscription counts use the latest recorded subscription-status event before the report boundary instead of the current status alone.

## Time and range policy

Timestamps remain UTC in PostgreSQL. Report presets and effective boundaries use `Asia/Karachi`. Synchronous Phase 1 reports are limited to 366 days; ledger exports are limited to 10,000 rows and fail clearly rather than silently truncating.

## Authorization

The current role model is mapped server-side to explicit capabilities: `premium:reports:read`, `premium:reports:export`, `premium:reconciliation:run`, `premium:plans:manage`, and `premium:subscriptions:adjust`.

Finance and Admin can read/export reports. Admin also receives plan and subscription-adjustment capabilities. Every API endpoint rechecks the capability; hiding a browser control is not authorization.

## Privacy and exports

Report rows expose deterministic masked user labels and safe provider references. They do not expose OTPs, access tokens, wallet credentials, raw provider payloads, full payment-account details or unrestricted customer information.

CSV output is UTF-8 with a BOM and protects values beginning with `=`, `+`, `-`, `@`, tab or carriage return. Every export writes an audit event containing the actor, report type, filters, effective range, row count, schema version and SHA-256 content hash. Exported customer rows are not stored in the audit record.

## Staging acceptance

Apply all migrations, create three isolated staging users, and run `scripts/seed-premium-reporting-staging.sql` with the staging environment and those user IDs supplied as psql variables.

For the same filters and range, verify that summary cash equals the CSV summary, payment rows reproduce gross/refund/net totals, recurring counts include only completed renewals, MRR remains separate from collected cash, and unauthorized roles cannot view or export reports.

Report generation is read-only. It never captures payments, triggers renewals, performs reconciliation repairs or changes entitlements.
