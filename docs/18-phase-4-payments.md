# Phase 4 — Payments and Entitlements

Implemented:

- monthly and annual PKR prices;
- hosted-checkout provider abstraction;
- safe mock checkout for local/staging;
- signed, idempotent payment events;
- checkout, payment, webhook, subscription and entitlement records;
- premium benefit checks;
- billing and finance views;
- premium playback gating.

Production activation requires merchant credentials and a provider adapter. Mock payments must remain disabled in production unless explicitly enabled for a controlled test environment.
