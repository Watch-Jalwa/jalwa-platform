# AI-Native Development Readiness — 2 August 2026

## Audit scope

This audit covers the complete connected `Watch-Jalwa` organization:

- one private repository: `Watch-Jalwa/jalwa-platform`;
- repository settings visible to the connected application;
- open issues, pull requests and branches;
- current operating documentation and workflow boundaries;
- implemented Ask Jalwa architecture and development controls.

## Organization result

- The organization contains one active repository.
- `main` is the release branch.
- The latest Vercel frontend deployment is ready, but remains frontend evidence until connected to a live transactional backend.
- Open work remains correctly limited to #22, #52 and #59.
- Issue #59 now has an explicit owner.
- Historical backup/unmerged branches remain intentionally retained; they are not valid bases for new work.
- Staging, content/media acceptance, seven-day live-source observation, invite-only activation and later production acceptance remain external/manual gates.

No additional product feature is required before staging deployment.

## Corrections made by this audit

- aligned the roadmap and launch runbook with the required first 50-item internal-alpha catalogue rather than the older 20–30 item pilot;
- established a versioned Ask Jalwa prompt registry;
- moved grounding, prompt-injection and moderation instructions out of route-level ad-hoc text;
- added a synthetic, versioned AI evaluation set and deterministic `npm run test:ai` gate;
- made the stored prompt version come from the prompt actually used;
- bounded AI request bodies before authentication, quota, database or provider work;
- stopped including AI-provider response bodies in application errors/logs;
- added prompt-injection, private/unpublished-data, high-consequence, language and request-boundary tests;
- expanded agent, contributor, feature-intake and pull-request requirements for AI changes;
- documented the post-deployment development restart and AI release gates.

## AI-native readiness definition

Jalwa is ready for further AI-native development after deployment acceptance when all of the following are true:

1. the transactional staging backend is live and reports the exact release SHA;
2. Vercel is connected to that backend without browser exposure of privileged values;
3. the selected media plane, backups, restore and rollback are proven;
4. 50 rights-complete items and the governed live catalogue pass their acceptance gates;
5. Ask Jalwa passes exact-configuration staging evaluation for grounding, citations, Urdu/Roman Urdu, refusal, prompt injection, leakage, latency and cost;
6. named product, rights, operations, security and stop-activation owners sign off;
7. the next phase is selected from measured tester and operational evidence.

## Required pattern for future AI features

Every AI feature must include:

- a stable Jalwa-side contract independent of one provider;
- bounded request and context inputs;
- versioned prompts and response schemas;
- access-filtered retrieval and minimum necessary context;
- explicit treatment of source/tool data as untrusted;
- deterministic fixtures plus live staging evaluation;
- safety, privacy, authorization and rights review;
- usage, latency, cost, model and prompt-version observability;
- emergency disablement and provider rollback;
- human approval for high-impact or privileged decisions.

## Provider strategy

The current implementation supports a configurable OpenAI-compatible completion provider. Provider-specific code remains inside the adapter.

Future OpenAI-specific agentic/tooling work should use the supported Responses and structured-output path inside that adapter. Provider/model migrations must use pinned or explicitly approved model identifiers where available, compare against the current baseline and pass the relevant eval suite before promotion.

## Development restart sequence

After #22, #52 and #59 have retained evidence:

1. publish the alpha findings and ranked defect/need list;
2. create scoped issues with measurable outcomes and non-goals;
3. fix reliability and operational gaps first;
4. select the next AI/content/commerce features from evidence;
5. implement through short-lived branches and reviewed PRs;
6. run CI, `npm run test:ai` where relevant and exact-configuration staging acceptance;
7. promote only immutable, staging-proven releases.

Until then, new development should remain limited to reproduced deployment/integration defects, failed acceptance gates or this explicitly approved readiness maintenance.
