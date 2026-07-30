# ADR 0003: Use entitlements as the access source of truth

## Status

Accepted.

## Decision

Payment providers create transactions and subscriptions, but Jalwa access is determined by time-bound benefit entitlements.

## Consequences

- 30-day passes work before automatic recurring billing;
- multiple providers can coexist;
- refunds, promotions and support grants are representable;
- playback code does not depend on one provider.
