# Jalwa Platform

Jalwa is a mobile-first Pakistani content platform for curated entertainment, learning, Deen, Kissan, technology, rozgar and family-safe discovery. It combines officially embedded third-party content, rights-cleared self-hosted media, Jalwa originals, paid entitlements and a catalogue-grounded AI assistant.

- **Primary market:** Pakistan
- **Primary domain:** `watch-jalwa.com`
- **Application model:** mobile-first responsive web application and installable PWA; native mobile apps and app-store distribution are out of current scope
- **Architecture:** modular monolith with a Next.js web application, background worker and PostgreSQL/Supabase control plane; media can use the existing Cloudflare R2/FFmpeg path or the protected AWS S3/SQS/MediaConvert/CloudFront path
- **Repository:** private monorepo

## Current status

Repository development for the controlled internal alpha is complete on `main` and protected by automated release gates.

- Final audited release SHA: `7f476e7ba0fd5c940fccc39b13f3ceb980a6d430`.
- The connected Vercel frontend deployment is ready and reports that exact SHA through `/api/health` and the browser release marker.
- Vercel remains a noindex frontend-preview environment until the transactional backend is deployed and connected.
- The rights-first alpha source register contains 151 approved discovery lanes. Source approval permits metadata discovery; it never auto-approves an individual asset for publication.
- The governed live-source implementation contains 46 user-facing entries backed by 52 source records. They remain disabled until the protected staging rights and activation process succeeds.
- Database-enforced availability, source/content/asset kill switches, rights holds, invite-only tester grants and Studio alpha operations are implemented.
- Self-hosted MP4/HLS, R2/FFmpeg rollback support, AWS MediaConvert infrastructure-as-code, private CloudFront delivery and signed playback are implemented but the owner-controlled AWS resources have not been applied.
- Catalogue, authentication, Studio, worker, payments, finance reporting, AI, backups, rollback, observability and release acceptance are repository-complete but still require a deployed backend for end-to-end evidence.

No additional speculative feature development is required before deployment. The next work is backend/infrastructure configuration, deployment, connection to Vercel, content/media acceptance and manual internal-alpha testing.

See [Current status and next-stage gates](docs/16-current-status-and-next-stage-gates.md), [Content, commerce and deployment handoff](docs/17-content-commerce-and-deployment-handoff.md) and [Internal alpha content platform](docs/24-internal-alpha-content-platform.md).

## Next operating phase

1. Configure the protected GitHub `staging` environment and owner-controlled DigitalOcean, Supabase, Cloudflare/R2, AWS, DNS, SSH, SMTP, AI, observability and signing values.
2. Bootstrap and deploy the isolated transactional backend from the exact green `main` SHA.
3. Apply the AWS media plane only after reviewing the Terraform plan; retain R2/FFmpeg as the rollback path.
4. Connect the Vercel frontend to the deployed backend and confirm health, readiness and release-SHA correlation.
5. Install the approved source registers, harvest metadata candidates and approve at least 50 mixed items through item-level rights, media and editorial QA.
6. Run kill-switch, queue/DLQ, HLS, mobile-browser, accessibility, backup, rollback and security acceptance.
7. Enable invite-only internal alpha only through the protected exact-SHA workflow.
8. Complete team manual testing and continue feature development from verified integration findings.

The approved delivery model is mobile-first web/PWA only. Android and iOS native applications, Google Play distribution and Apple App Store distribution are not part of the current roadmap or release gates.

## Local development

Requirements:

- Node.js 22
- npm 10
- Docker with Compose for production-container validation
- PostgreSQL client tools for migration and fixture work

```bash
npm ci
npm run dev
```

Required validation before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run test:release
npm run test:backup-encryption
npm run build
```

The GitHub CI workflow additionally validates infrastructure, applies migrations against a clean PostgreSQL service, audits production dependencies, generates a CycloneDX SBOM, builds and scans production images, boots the production web image and runs browser journeys.

## Repository layout

```text
apps/
  web/                         consumer PWA, Studio and server routes
  worker/                      ingestion, media processing and scheduled work
supabase/migrations/           forward-only database migrations
content/                       approved source registers and governed inputs
infrastructure/
  aws-media/                   private AWS video processing and delivery plane
  digitalocean/                Terraform host provisioning
  media-gateway/               Cloudflare media gateway
  production/                  Compose stack, deployment and acceptance scripts
scripts/                       release, backup, fixture, harvesting and validation utilities
docs/                          product, architecture, operations and handoff documents
.github/                       CI/CD, Dependabot, templates and ownership rules
```

## Documentation

1. [Executive product plan](docs/00-executive-plan.md)
2. [Product requirements](docs/01-product-requirements.md)
3. [Information architecture](docs/02-information-architecture.md)
4. [System architecture](docs/03-system-architecture.md)
5. [Data model](docs/04-data-model.md)
6. [Media and streaming](docs/05-media-streaming.md)
7. [Content rights and operations](docs/06-content-rights-and-operations.md)
8. [AI-native platform](docs/07-ai-native-platform.md)
9. [Payments and subscriptions](docs/08-payments-and-subscriptions.md)
10. [Security, privacy and trust](docs/09-security-privacy-and-trust.md)
11. [Roadmap and backlog](docs/10-roadmap-and-backlog.md)
12. [Launch runbook](docs/11-launch-runbook.md)
13. [Content source catalogue](docs/12-content-source-catalogue.md)
14. [Repository and engineering workflow](docs/13-repository-and-engineering-workflow.md)
15. [External references](docs/14-references.md)
16. [Foundation implementation history](docs/15-phase-1-foundation.md)
17. [Current status and next-stage gates](docs/16-current-status-and-next-stage-gates.md)
18. [Content, commerce and deployment handoff](docs/17-content-commerce-and-deployment-handoff.md)
19. [Repository readiness audit — 31 July 2026](docs/18-repository-audit-2026-07-31.md)
20. [Initial public-domain live source integration](docs/19-public-domain-live-source-integration.md)
21. [Public-domain live activation runbook](docs/20-public-domain-live-activation-runbook.md)
22. [Approved public-domain live rights](docs/21-approved-public-domain-live-rights.md)
23. [Institutional public-affairs live sources](docs/22-institutional-public-affairs-live-sources.md)
24. [Open-government live expansion](docs/23-open-government-live-expansion.md)
25. [Internal alpha content platform](docs/24-internal-alpha-content-platform.md)
26. [Organization audit — 1 August 2026](docs/25-organization-audit-2026-08-01.md)

## Open operational trackers

- [#22](https://github.com/Watch-Jalwa/jalwa-platform/issues/22) — umbrella backend, staging, commerce and production activation.
- [#52](https://github.com/Watch-Jalwa/jalwa-platform/issues/52) — 46-entry governed live-catalogue staging and activation.
- [#59](https://github.com/Watch-Jalwa/jalwa-platform/issues/59) — internal-alpha content/media deployment and 50-item acceptance.

## Non-negotiable release rules

- Never self-host media without approved item-level distribution rights and retained evidence.
- Never download YouTube content; use official embeds only.
- Never grant paid access from a browser return URL or screenshot alone.
- Never store card details; use a hosted provider flow and signed server-side webhooks.
- Never expose service-role, provider, deployment or media-signing secrets to the browser.
- Never deploy mutable image tags.
- Keep live streaming and web DRM disabled until contracted providers and browser acceptance are complete.
- Treat the current Vercel deployment as frontend evidence only until it is connected to the deployed transactional backend.
- Production promotion requires a green `main` commit, staging acceptance, immutable artifacts, backup evidence and explicit approval.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing the repository. Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md); do not open public security issues.
