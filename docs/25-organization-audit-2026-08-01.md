# Watch-Jalwa Organization Audit — 1 August 2026

## Scope

This audit covers the complete GitHub organization available to the connected application.

- Organization: `Watch-Jalwa`
- Accessible repositories: 1
- Repository: `Watch-Jalwa/jalwa-platform`
- Visibility: private
- Default branch: `main`
- Application release audited at the start of cleanup: `7f476e7ba0fd5c940fccc39b13f3ceb980a6d430`

No second repository or hidden sample repository was omitted from the connected organization scope.

## Executive result

The organization is in a safe development pause while the project team deploys and manually tests the transactional backend.

- No open pull requests remain after the audit-maintenance pull request is merged.
- Three open issues remain, each tied to a real deployment or activation boundary.
- Repository CI, database migrations, production builds, container security policy and browser journeys passed on the final implementation and audit-maintenance changes.
- The Vercel frontend deployment is ready and reports its exact deployed SHA.
- Internal alpha and governed live-source activation remain fail-closed.
- No further speculative feature development is required before backend deployment.

## Repository and release audit

### Application implementation lineage

- PR #60 implemented the internal-alpha content platform.
- PR #61 fixed exact Vercel release reporting in health checks.
- PR #62 aligned the browser release marker with Vercel release identity.
- Application release audited before organization cleanup: `7f476e7ba0fd5c940fccc39b13f3ceb980a6d430`.
- Vercel deployment at that point: `dpl_8aJR63X2r7gJQy6XWkqs3b4m1uju`, READY.

### Audit and cleanup lineage

- PR #63 synchronized the operating documentation, governance and issue trackers and introduced guarded branch maintenance.
- PR #64 scheduled completed-branch cleanup.
- PR #65 fixed authenticated private-repository ref discovery.
- PR #66 added guarded same-repository execution, squash-merge recognition, explicit supersession recognition, synthetic-ref filtering and verified do-not-merge test-marker cleanup.

Every audit-maintenance change was required to pass the same repository pipeline as product code before merge.

### Validation evidence

The final changes passed:

- clean PostgreSQL migration application;
- production privilege checks;
- Terraform formatting and validation;
- production dependency audit;
- CycloneDX SBOM generation;
- lint and strict TypeScript;
- unit, contract, release and backup-encryption tests;
- Next.js and worker production builds;
- production web and worker container builds;
- fixable high/critical vulnerability rejection;
- runtime image contracts and web-container boot;
- desktop/mobile browser journeys;
- AWS Lambda syntax and media-infrastructure contract checks.

## Pull-request audit

- Open PRs after cleanup: 0.
- Merged implementation PRs include complete product, security, deployment, media, rights, payment, finance, observability and acceptance work.
- Superseded PRs are closed and identify their replacement where relevant.
- Major Dependabot proposals were closed rather than merged without compatibility work.
- The current PR template requires data, security, rights, payment, AI, observability, test and rollback evidence.

No abandoned open PR requires review or closure.

## Issue audit

### Issues that should remain open

#### #22 — Deploy, test and activate the Jalwa transactional platform

Umbrella tracker for owner-controlled backend deployment, Vercel connection, staging evidence, commerce/provider activation and eventual production promotion.

#### #52 — Activate the approved 46-entry live catalogue

Tracker for item/source evidence, staging observation and protected activation of the governed live inventory.

#### #59 — Deploy and accept the internal-alpha content and media platform

Tracker for media-backend selection, AWS/R2 deployment, 50-item rights/media/editorial acceptance and invite-only activation.

### Closed issues

- #44 and #45 were completed by PR #46.
- #50 is explicitly documented as an accidental placeholder closed as not planned.

No duplicate open feature issue or completed implementation issue remains open.

## Documentation audit

### Healthy governance documents

- `CONTRIBUTING.md` defines branch, validation, security, rights, payment, migration, dependency and release requirements.
- `SECURITY.md` requires private vulnerability reporting and defines safe research boundaries.
- `.github/CODEOWNERS` covers application, worker, infrastructure, migrations, workflows and documentation.
- Structured issue forms exist for bugs, features, content sources and release blockers.
- The pull-request template requires complete cross-layer evidence.

### Findings corrected by this audit

- `README.md` described a pre-alpha operating phase and omitted documents 20–24.
- `docs/16-current-status-and-next-stage-gates.md` was dated before the 151-source alpha implementation and still reported launch content as not started.
- `docs/17-content-commerce-and-deployment-handoff.md` still instructed the team to begin a generic 20–30 item pilot instead of deploying the completed backend and proving the first 50 alpha items.
- The internal-alpha documentation did not include the final merged and Vercel release evidence.
- The repository lacked a current organization-wide audit record after the alpha implementation.
- Issue #59 still read as an unstarted engineering plan even though its repository implementation was merged.

The audit updates those sources without rewriting historical planning or prior dated evidence.

## Branch audit

At the start of the audit the repository contained 49 non-`main` branches. Temporary audit work raised the peak inventory to 53 total branches.

The guarded cleanup removed 48 completed, explicitly superseded or verified do-not-merge test branches from that peak inventory. Immediately before the final cleanup PR is merged, five branches remain:

- `main`;
- `backup/pre-mvp-main`, retained intentionally;
- `chore/run-merged-branch-cleanup`, retained while its pull request is open and eligible for deletion on the pull-request close event;
- `agent/browser-launch-acceptance`;
- `agent/security-boundary`.

The two remaining agent branches have substantive unique historical commits and no pull-request record that explicitly authorizes their deletion. They are deliberately retained rather than guessed away. Both are far behind the current `main` and must not be used as the base for new work. Any later owner decision to remove them should first confirm that their unique commits are unnecessary or record where their replacement work landed.

The disposable `agent/internal-alpha-content-platform-test` branch was removed only after verification showed that its sole unique change was the explicit `tmp-do-not-merge.txt` marker.

### Cleanup policy

The protected maintenance workflow may delete a branch only when it has no open pull request, does not match a protected retention pattern and one of these is true:

- its current head is a Git ancestor of `main`;
- its current head exactly matches the head SHA of a merged pull request to `main`;
- its current head exactly matches a closed pull request whose body explicitly begins with `Superseded by`, documenting replacement work;
- it matches `agent/*-test` and its only unique file is `tmp-do-not-merge.txt`.

The workflow deliberately retains:

- `backup/*`;
- conventional environment, release and hotfix branches;
- every branch with an open pull request;
- every otherwise unexplained unmerged head.

It runs when its definition changes in a same-repository pull request, when that pull request closes, on relevant `main` pushes, weekly and by manual dispatch. Fork pull requests cannot execute its write job.

## Security and secrets audit

- No production credential or private key was added during the audit.
- Environment examples remain placeholders.
- Service-role, media-control, signing, AWS, Cloudflare, database and payment secrets remain server-side/protected-environment values.
- Vercel remains noindex and is not described as a full transactional launch.
- Internal-alpha and live-source flags remain disabled until protected workflows succeed.
- Branch cleanup uses only the job-scoped GitHub token with top-level read-only permissions and job-scoped `contents: write` plus `pull-requests: read`.

## Rights and content audit

- Source-level approval is explicitly limited to metadata discovery.
- Item-level rights, attribution, evidence, territory, expiry and editorial review remain mandatory.
- Official embeds and official-link sources stay provider-hosted.
- The 46-entry live catalogue remains disabled pending evidence and observation.
- The 151-source register does not trigger downloads or publication.
- Stock assets remain derivative-production inputs rather than unchanged catalogue items.

## Remaining external work

The organization is waiting for the deployment team to provide:

- configured protected staging environment;
- transactional backend deployment and exact-SHA evidence;
- AWS media plan/apply or explicit R2/FFmpeg selection;
- Vercel-to-backend connection;
- 50 rights-approved and media-QA-complete items;
- authentication, Studio, HLS, queue, takedown, backup and rollback acceptance;
- Android, iPhone and desktop manual test results;
- named rights, operations, security and incident sign-off.

## Development restart rule

Resume repository development only when one of these exists:

1. a reproduced deployment/integration defect;
2. a failed acceptance gate tied to an exact deployed SHA;
3. an approved next-phase product requirement after manual alpha evidence.

Do not create speculative feature branches while the backend deployment is pending.
