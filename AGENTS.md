# Jalwa Agent Guide

## Mission

Build a mobile-first Pakistani content portal with rights-aware playback, paid entitlements and grounded AI.

## Development rules

- Read the relevant `docs/` file before changing a domain.
- Keep one modular monolith until a measured boundary requires separation.
- Never self-host media without an approved rights record.
- Never download YouTube media.
- Never activate premium from a browser return URL alone.
- Keep Urdu, RTL, accessibility and low-data behaviour in acceptance criteria.
- Keep prompts and evaluations in version control.
- Add tests for business rules and security-sensitive paths.
- Never expose server secrets to client components.
- Every privileged mutation must be auditable.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```
