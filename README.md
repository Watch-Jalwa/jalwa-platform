# Jalwa Platform

Jalwa is a mobile-first Pakistani content platform for curated entertainment, learning, Deen, Kissan, technology, rozgar and family-safe discovery. It combines officially embedded third-party content, rights-cleared self-hosted media, Jalwa originals, paid entitlements and a catalogue-grounded AI assistant.

- **Primary market:** Pakistan
- **Primary domain:** `watch-jalwa.com`
- **Application model:** responsive web application and PWA
- **Architecture:** modular monolith with a Next.js web application, background worker, PostgreSQL/Supabase services and Cloudflare R2 media storage
- **Repository:** private monorepo

## Current status

The repository-side product foundation is implemented and protected by automated release gates:

- catalogue, categories, search, content pages and official YouTube embeds;
- rights evidence, source records, attribution, expiry and takedown controls;
- Jalwa Studio content, moderation, support, operations, finance and Premium reporting areas;
- Supabase authentication, profiles, watch history, account export and deletion workflows;
- self-hosted media ingestion, FFmpeg processing, MP4/HLS playback and signed media access;
- plans, prices, checkout orders, payment lifecycle normalization, entitlements and audited finance reports;
- Ask Jalwa gateway, quotas, moderation and catalogue citations;
- isolated staging and production infrastructure workflows using immutable commit-SHA images;
- encrypted off-site backups, restore drills, transactional rollback and release-correlated diagnostics;
- lint, strict type checking, unit/contract tests, migration tests, dependency audit, SBOM generation, container vulnerability checks, production image boot checks and Chromium desktop/mobile journeys.

The latest frontend is built on Vercel. That is not evidence of a full transactional staging or production launch. Live staging and production still require the external environment values, provider accounts, DNS, infrastructure and acceptance evidence listed in [Current status and next-stage gates](docs/16-current-status-and-next-stage-gates.md).

## Next operating phase

Repository development is ready to move into four controlled workstreams:

1. configure the isolated staging environment and retain live acceptance evidence;
2. onboard an initial rights-cleared catalogue through the governed Studio workflow;
3. complete merchant/provider, pricing, refund and customer-support decisions;
4. promote a validated staging release to production only after the production checklist is complete.

See [Content, commerce and deployment handoff](docs/17-content-commerce-and-deployment-handoff.md).

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
infrastructure/
  digitalocean/                Terraform host provisioning
  media-gateway/               Cloudflare media gateway
  production/                  Compose stack, deployment and acceptance scripts
scripts/                       release, backup, fixture and validation utilities
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

## Non-negotiable release rules

- Never self-host media without approved distribution rights and retained evidence.
- Never download YouTube content; use official embeds only.
- Never grant paid access from a browser return URL or screenshot alone.
- Never store card details; use a hosted provider flow and signed server-side webhooks.
- Never expose service-role, provider, deployment or media-signing secrets to the browser.
- Never deploy mutable image tags.
- Keep live streaming and web DRM disabled until contracted providers and browser acceptance are complete.
- Treat Vercel previews as frontend evidence only, not full-stack release evidence.
- Production promotion requires a green `main` commit, staging acceptance, immutable artifacts, backup evidence and explicit approval.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing the repository. Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md); do not open public security issues.
