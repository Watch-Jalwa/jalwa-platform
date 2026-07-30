# Delivery Roadmap and Backlog

## Suggested twelve-week path

This assumes one strong full-stack developer with part-time design, content and review support.

## Phase 0 — Business and access, days 1–5

- create `Watch-Jalwa/jalwa-platform`;
- install GitHub app access;
- confirm domain ownership;
- choose legal entity and merchant applicant;
- begin PayFast, JazzCash and easypaisa onboarding;
- approve launch categories;
- approve initial pricing hypothesis;
- appoint content and rights owners.

Exit: repository, environments and merchant onboarding are active.

## Phase 1 — Foundation, weeks 1–2

- monorepo;
- Next.js PWA shell;
- design tokens;
- Urdu/RTL support;
- PostgreSQL schema;
- authentication;
- staff RBAC;
- CI;
- staging;
- observability.

Exit: authenticated shell and studio skeleton deployed.

## Phase 2 — Catalogue and studio, weeks 3–4

- content model;
- categories;
- collections;
- content pages;
- admin editor;
- source records;
- rights records;
- publishing workflow;
- YouTube URL import;
- search;
- home rows.

Exit: editors can safely publish embedded and article content.

## Phase 3 — Media and viewing, weeks 5–6

- direct upload;
- R2 storage;
- FFmpeg worker;
- short MP4 pipeline;
- HLS long-form pipeline;
- playback tokens;
- watch progress;
- favourites;
- shorts feed;
- playback telemetry.

Exit: owned/open media plays on mobile and desktop.

## Phase 4 — Payments and premium, week 7

- plans and prices;
- checkout orders;
- first provider adapter;
- hosted checkout;
- callbacks/webhooks;
- entitlements;
- premium gates;
- receipts;
- reconciliation admin.

Exit: real or sandbox payment activates and expires access.

## Phase 5 — AI layer, week 8

- AI gateway;
- prompt registry;
- catalogue embeddings;
- Ask Jalwa;
- citations;
- moderation;
- usage ledger;
- free/premium quotas;
- basic eval suite.

Exit: grounded AI works with measurable cost.

## Phase 6 — Content seed and hardening, weeks 9–10

- 150-item launch catalogue;
- Urdu/Roman Urdu metadata;
- source and licence evidence;
- Kissan and Deen review;
- performance;
- accessibility;
- payment failure cases;
- backups;
- legal pages;
- support scripts.

Exit: internal launch checklist passes.

## Phase 7 — Closed beta, week 11

- invite 50–100 users;
- test low-end Android browsers;
- test mobile networks;
- monitor payment conversion;
- fix playback failures;
- gather content demand;
- verify support response.

Exit: no unresolved critical defects.

## Phase 8 — Public launch, week 12

- activate production pricing;
- launch campaign;
- daily operations room;
- content calendar;
- subscription dashboard;
- weekly KPI review.

## Product epics

### EPIC-001 Platform foundation

- monorepo;
- environments;
- CI;
- configuration;
- design system;
- PWA.

### EPIC-002 Identity and profiles

- auth;
- preferences;
- history;
- account settings;
- deletion.

### EPIC-003 Catalogue and discovery

- taxonomy;
- home;
- search;
- collections;
- related content;
- SEO.

### EPIC-004 Studio and rights

- source import;
- rights evidence;
- review states;
- scheduling;
- audit.

### EPIC-005 Media pipeline

- uploads;
- validation;
- FFmpeg;
- R2;
- player;
- captions;
- shorts.

### EPIC-006 Payments and entitlement

- provider adapter;
- checkout;
- webhook;
- passes/subscription;
- premium benefits;
- finance admin.

### EPIC-007 Ask Jalwa

- RAG;
- citations;
- quotas;
- prompts;
- evals;
- moderation.

### EPIC-008 Analytics and operations

- event plan;
- dashboards;
- error monitoring;
- support;
- reconciliation.

### EPIC-009 Content launch

- source allowlist;
- catalogue targets;
- localisation;
- category calendar;
- creator outreach.

### EPIC-010 Security and legal

- threat model;
- policies;
- privacy;
- takedown;
- penetration checklist;
- incident response.

## Definition of done for every feature

- acceptance criteria met;
- mobile UI checked;
- Urdu/RTL checked;
- tests added;
- analytics event defined;
- error state handled;
- permission checks added;
- accessibility checked;
- documentation updated;
- no unresolved high-severity security issue;
- AI features pass relevant evals;
- content features preserve source and rights metadata.
