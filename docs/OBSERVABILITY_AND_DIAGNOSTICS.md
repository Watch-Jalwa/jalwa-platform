# Production observability and diagnostics

Jalwa emits structured JSON events to stdout/stderr for collection by the production logging platform. Every event includes the service, environment, immutable release SHA, severity, event name and timestamp. Request IDs are included when available.

## Privacy and safety

Observability is intentionally dependency-free and fail-open for users: reporting failures never turn a successful customer request into an error. Sensitive keys are redacted, payloads are bounded, browser reports are rate-limited, query strings are removed from paths and user agents are represented only by salted hashes.

## Coverage

- Next.js server request errors through `instrumentation.ts`;
- Node.js uncaught exceptions and unhandled rejections;
- browser errors, unhandled promise rejections and global render failures;
- CSP violations;
- release SHA correlation.

## Readiness diagnostics

Public readiness exposes only service status, version and time. Detailed database, migration, storage, lifecycle, payment, feature and configuration diagnostics require the `x-jalwa-operations-token` header to match `OPERATIONS_DIAGNOSTICS_SECRET`. The secret is optional; when absent, detailed diagnostics remain disabled and public readiness continues to function.

## Operations

Route container stdout/stderr to the selected log and alert platform. Configure alerts for `fatal`, sustained `error`, payment events, authentication failures, media processing failures, migration failures and elevated CSP violations. Access to logs must be restricted and retention must follow the privacy policy.
