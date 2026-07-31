# Security release gates

A release is blocked unless all repository, dependency and shipped-artifact gates pass.

## Application images

CI builds the exact web and worker runtime images, installs a fixed Trivy release from the official release assets, verifies the checksum manifest against the repository-pinned digest, and then verifies each downloaded scanner archive against that manifest.

The image gate scans operating-system and language packages and rejects any fixable `HIGH` or `CRITICAL` vulnerability. Unfixed findings remain visible in scanner reports but do not block a release until an upstream fix is available. Exceptions must not be added to the scan script. A temporary exception requires a separately reviewed change documenting the CVE, affected image, compensating control, owner and expiry date.

## Production stack

Before the first production deployment, run the same scanner against every image resolved by the production Compose files, including the Jalwa web and worker images, Caddy and the pinned self-hosted Supabase stack. Retain the JSON reports with the deployment evidence.

## Evidence

Release evidence must contain:

- application dependency audit output;
- CycloneDX application SBOM;
- web and worker image scan reports;
- production-stack image scan reports;
- image provenance and SBOM attestations;
- the deployed immutable Git SHA.
