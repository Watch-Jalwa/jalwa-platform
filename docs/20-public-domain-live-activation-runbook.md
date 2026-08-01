# Public-Domain Live-Source Activation Runbook

This runbook governs the operational activation of the nine approved NASA, NOAA and USGS live entries after the application release itself has been deployed. It supplements the architecture and rights plan in `docs/19-public-domain-live-source-integration.md` and the master tracker in issue #52.

## Boundary

The deployment workflows continue to generate runtime environments without `PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED`. Every normal staging or production deployment therefore returns the catalogue to a fail-closed state.

Use the manual **Set public-domain live sources** workflow as the only supported enable/disable path. Do not edit `/opt/jalwa/.env.production` manually.

The workflow:

- requires an exact deployed `main` SHA;
- uses the protected `staging` or `production` GitHub environment;
- verifies the host environment and deployed `GIT_SHA` before changing state;
- updates the feature flag atomically;
- recreates web, worker and proxy services under the deployment lock;
- runs the normal release smoke test;
- runs provider-aware source health when enabling;
- runs the 390×844 reduced-motion public live-source browser acceptance;
- disables the feature automatically when post-enable browser acceptance fails;
- records the run and approval reference on issue #52.

## Prerequisites common to both environments

Before enabling:

- the exact release SHA is deployed and healthy;
- all intended source records exist;
- every enabled source configuration is in the committed allowlist;
- item-level official-source and terms evidence is retained;
- rights approval and the next review date are current;
- the seven individual items and two collections are published;
- all entries remain public and are not Premium-gated;
- advertising does not overlay or enter an external player or current image;
- the immediate Studio unpublish and disable controls have been rehearsed.

## Staging sequence

1. Bootstrap and deploy isolated staging from a green `main` SHA.
2. Run the staging acceptance workflow to seed disabled live-source drafts.
3. Complete item-level rights review and publish only the approved inventory.
4. Dispatch **Set public-domain live sources** from `main` with:
   - target environment: `staging`;
   - enabled: `true`;
   - release SHA: the exact deployed SHA;
   - approval reference: the issue #52 comment or evidence record covering the reviewed inventory.
5. Confirm the workflow passes source health and mobile browser acceptance.
6. Treat the successful workflow timestamp as the earliest possible beginning of the seven-day observation window.
7. Retain scheduled health results, availability transitions, stale-image checks, browser errors and the unpublish rehearsal for at least seven continuous days.
8. Reverify official terms, source pages and attribution at the end of observation.
9. Add the observation summary and explicit production approval to issue #52.

A material application, source-definition, rights, attribution or collection-membership change requires a new exact-SHA acceptance record and may require the observation window to restart.

## Production deployment sequence

1. Select the exact green `main` SHA proven during staging observation.
2. Deploy production normally. The live-source catalogue remains disabled after deployment.
3. Verify readiness SHA, services, migrations, worker health, encrypted backups, restore drill and rollback.
4. Load only the rights-approved source records and collections.
5. Run provider-aware source health while the public catalogue remains disabled.
6. Obtain approval through the protected GitHub `production` environment.
7. Dispatch **Set public-domain live sources** from `main` with:
   - target environment: `production`;
   - enabled: `true`;
   - release SHA: the exact deployed and staging-proven SHA;
   - approval reference: an issue #52 URL containing the completed staging-observation and rights approval.
8. Confirm the workflow passes source health and production mobile acceptance.
9. Retain the workflow run URL, enabled inventory, exact SHA, approval reference and stop-launch owner in the production release record.

## Emergency disable

For a broad or uncertain source problem, dispatch **Set public-domain live sources** with `enabled=false`. This is the preferred immediate containment path and does not require a new image deployment.

For one source only, use the Studio source disable or emergency unpublish control and retain the reason and evidence in issue #52.

Disable immediately for:

- rights or terms review expiry;
- a serious attribution or endorsement error;
- an unapproved source or collection member;
- unsafe proxy, iframe or origin behavior;
- repeated source-health failures without a valid off-air explanation;
- Premium gating or advertising overlay;
- release SHA mismatch;
- failed smoke, source-health or browser acceptance.

## Production completion evidence

Issue #52 may be closed only after it contains:

- the exact staging and production release SHA;
- item-level rights and attribution approvals;
- the seven-day staging observation summary;
- successful staging and production activation workflow links;
- the final enabled source and collection inventory;
- production readiness, migration, backup and restore evidence;
- the named operational and stop-launch owner;
- confirmation that emergency disable remains verified.