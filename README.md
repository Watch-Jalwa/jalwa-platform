# Jalwa Platform

**Domain:** `watch-jalwa.com`  
**Market:** Pakistan  
**Product:** Mobile-first, browser-based freemium content portal with AI-assisted discovery, learning and content operations.

Jalwa is designed as a curated Pakistani content platform rather than a clone of YouTube or a rights-heavy television service. It combines:

- officially embedded third-party content;
- self-hosted public-domain and commercially reusable open-license content;
- Jalwa-owned shorts, explainers and programmes;
- creator and institutional partnerships;
- freemium subscriptions;
- an AI assistant grounded in Jalwa's approved catalogue.

## Launch objective

Launch a working paid product quickly with:

1. responsive PWA;
2. catalogue, categories, search and playback;
3. user accounts and watch history;
4. admin content studio;
5. rights and attribution records;
6. self-hosted shorts and selected long-form content;
7. a Pakistan-compatible hosted checkout;
8. paid entitlements;
9. AI search and “Ask Jalwa”;
10. analytics, moderation, takedown and launch operations.

## Recommended launch categories

- Jalwa Originals
- Shorts
- Entertainment
- Deen
- Kissan & Farming
- Learn
- Tech & AI
- Rozgar, Business & Freelancing
- Pakistan
- Kids & Family
- Health & Life
- Live

The existing product deck already proposes Deen, Learn, Tech, Pakistan, Grow, Explore, Kids and Life. Jalwa retains that logic while elevating **Kissan & Farming**, **Originals**, **Entertainment** and **Shorts** as explicit acquisition surfaces for Pakistan.

## Repository strategy

Create **one repository now**:

`Watch-Jalwa/jalwa-platform`

Use a monorepo. Do not create separate frontend, backend, admin and AI repositories at MVP stage.

```text
jalwa-platform/
├── apps/
│   ├── web/                 # Consumer PWA + server routes
│   ├── worker/              # ingestion, FFmpeg and scheduled jobs
│   └── studio/              # optional later split; start inside web
├── packages/
│   ├── ai/
│   ├── auth/
│   ├── content/
│   ├── database/
│   ├── media/
│   ├── payments/
│   ├── ui/
│   ├── observability/
│   └── config/
├── prompts/
├── evals/
├── docs/
├── infrastructure/
├── scripts/
└── .github/
```

Create additional repositories only after an operational need appears:

- `jalwa-infrastructure` — only when infrastructure access must be separated.
- `jalwa-brand` — only if external designers need independent access.
- `jalwa-mobile` — only when a native application is actually funded.

## Documentation index

1. [Executive product plan](docs/00-executive-plan.md)
2. [Product requirements](docs/01-product-requirements.md)
3. [Information architecture](docs/02-information-architecture.md)
4. [System architecture](docs/03-system-architecture.md)
5. [Data model](docs/04-data-model.md)
6. [Media and streaming](docs/05-media-streaming.md)
7. [Content rights and operations](docs/06-content-rights-and-operations.md)
8. [AI-native plan](docs/07-ai-native-platform.md)
9. [Payments and subscriptions](docs/08-payments-and-subscriptions.md)
10. [Security, privacy and trust](docs/09-security-privacy-and-trust.md)
11. [Delivery roadmap and backlog](docs/10-roadmap-and-backlog.md)
12. [Launch runbook](docs/11-launch-runbook.md)
13. [Content source catalogue](docs/12-content-source-catalogue.md)
14. [Repository and engineering workflow](docs/13-repository-and-engineering-workflow.md)
15. [External references](docs/14-references.md)

## Immediate decisions

- Use a modular monolith, not microservices.
- Use hosted checkout; never store card details.
- Treat subscriptions as entitlements independent of the payment provider.
- Use YouTube only through official embeds.
- Keep YouTube content outside premium paywalls.
- Self-host only content Jalwa owns or has verified distribution rights for.
- Do not originate live television or sports at MVP.
- Start with Urdu, English and Roman Urdu metadata.
- Make every content item carry a source, licence and attribution record.
- Put all AI calls behind a server-side AI gateway with quotas and audit logs.

## Implementation status

Phase 1 foundation is implemented on `agent/phase-1-foundation`:

- npm workspaces for the web and worker;
- Next.js mobile-first PWA shell;
- Supabase SSR authentication scaffold;
- Urdu/RTL-ready design foundation;
- PostgreSQL profiles, roles and audit migration;
- Docker and GitHub Actions CI.

See [Phase 1 Foundation](docs/15-phase-1-foundation.md).
