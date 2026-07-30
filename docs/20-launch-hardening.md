# Phase 6 — Launch Hardening

Implemented:

- public Terms, Privacy, Subscription, Refund, Copyright and AI Safety pages;
- customer support form and server-side case creation;
- staff support queue with status workflow;
- account export and deletion requests;
- first-party, privacy-conscious event collection;
- database-backed rate limiting for public write endpoints;
- liveness and production-readiness endpoints;
- Studio operations dashboard;
- robots and sitemap metadata;
- production configuration checks.

## Database migration

Apply `202607300006_launch_hardening.sql` after the AI migration.

## New runtime configuration

- `RATE_LIMIT_SALT`: a long random secret used when hashing request-rate identifiers.

## Operational endpoints

- `/api/health`: confirms the web process is alive.
- `/api/readiness`: checks required configuration and database access.

## Staff routes

- `/studio/operations`: catalogue, support, payment, entitlement, privacy-request and analytics counts.
- `/studio/support`: support queue for users with `support` or `admin` role.

## Launch review still required

The included policy pages are product-complete launch drafts, not a substitute for review by Pakistani counsel. Replace the review notices only after business, payment-provider and legal terms are approved.
