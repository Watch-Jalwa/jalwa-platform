# Production readiness and promotion gate

Status: authoritative release gate. Production deployment is prohibited until every prerequisite below is proven for the exact release SHA.

## Required evidence chain

1. Repository CI is green for the exact `main` release SHA.
2. **Deploy staging** succeeds for that SHA and records immutable web/worker GHCR repository digests plus build provenance.
3. **Staging certification** succeeds and its retained artifact reports `READY FOR UAT` for that exact SHA.
4. **Payment provider sandbox certification** succeeds for the same SHA, the same staging deployment run and the same provider family intended for production. `mock` is not accepted by this gate.
5. Human UAT is completed and a retained approval reference is supplied to the production deployment.
6. Production deployment is explicitly confirmed and the protected `production` environment is complete.

## No rebuild in production

Production never rebuilds application images. The deployment workflow downloads the retained staging certification evidence, extracts the exact web and worker `repo_digest` values and promotes those digest-addressed images.

The production host records separate provenance:

- source release SHA;
- staging image build run ID;
- production deployment run ID;
- exact web/worker registry digests;
- exact running image IDs;
- rollback release reference.

A mismatch in SHA, build provenance, digest, provider sandbox evidence or UAT evidence blocks production.

## Real payment-provider gate

Jalwa supports the configured provider adapter families `payfast`, `jazzcash` and `easypaisa`. Before production, staging must be switched from the isolated mock provider to the selected provider's sandbox/UAT adapter configuration without changing the certified application images.

The sandbox gate proves:

- authenticated checkout uses the authoritative Jalwa price;
- the checkout order records the selected provider;
- the adapter returns an HTTPS redirect on the explicitly configured sandbox host and not the Jalwa mock checkout path;
- the signed provider webhook boundary accepts a valid lifecycle event for the order;
- the order reaches `succeeded` with matching amount/currency;
- Premium subscription and entitlements are created;
- mobile checkout reaches the same sandbox provider boundary.

The sandbox report is sanitized and retained as a GitHub Actions artifact. Production must use the same provider family as that retained PASS evidence.

## Production deployment controls

Production additionally requires:

- explicit `confirm_production=true`;
- exact staging-certified release SHA;
- Staging certification run ID;
- Payment provider sandbox certification run ID;
- human UAT approval reference;
- production host/domain/pinned SSH identity;
- PostgreSQL, Better Auth, SMTP, R2, GHCR and operations secrets;
- live credentials for the selected payment provider;
- pre-migration backup when an initialized database exists;
- migration application;
- exact-digest deployment;
- release identity capture;
- post-release encrypted backup;
- restore drill;
- non-destructive host acceptance.

Rollback restores the exact web/worker image references retained for the prior successful release rather than rebuilding or resolving an untested image.

## Current external blocker

The code path can enforce this gate, but staging cannot execute until the protected GitHub `staging` environment contains a real host/domain plus SSH, GHCR, Cloudflare/R2, SMTP and required Jalwa secrets. The first real staging deployment attempt proved these values are currently absent.

Production credentials must remain separate from staging. Do not place secret values in repository files, issues, chat or documentation.
