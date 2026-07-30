# ADR 0001: Use a modular monolith

## Status

Accepted for MVP.

## Decision

Use one TypeScript monorepo with web and worker processes. Keep domain modules separated inside packages.

## Reason

The product and rights model will change rapidly. Microservices would increase deployment, observability, contract and data-consistency cost without solving an existing scale problem.

## Consequences

- faster delivery;
- shared types;
- simpler transactions;
- modules must still expose clear interfaces;
- split services only after measured bottlenecks or team boundaries appear.
