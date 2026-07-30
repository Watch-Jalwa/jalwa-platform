# Repository and Engineering Workflow

## Primary repository

`Watch-Jalwa/jalwa-platform`

Visibility: private during development. Decide later whether selected packages or documentation become public.

## Why one repository

- one atomic change can update UI, API, schema and worker;
- shared types;
- simpler AI-assisted development;
- one CI pipeline;
- one issue tracker;
- lower coordination cost;
- easier refactoring before product-market fit.

## Branch policy

- protected `main`;
- short-lived branches;
- branch names such as `feat/catalogue-search`;
- pull request required;
- squash merge;
- delete merged branches;
- emergency hotfix documented after resolution.

## Pull request requirements

Every PR should include:

- problem;
- solution;
- screenshots for UI;
- schema or API impact;
- security impact;
- content-rights impact;
- analytics events;
- test plan;
- rollback;
- AI prompt/model impact;
- linked issue.

## CI checks

Required:

- formatting;
- lint;
- typecheck;
- unit tests;
- database migration validation;
- API contract tests;
- build;
- end-to-end smoke tests;
- secret scan;
- dependency vulnerability check.

For media code, include fixture-based FFmpeg tests without committing large videos.

## AI-first engineering process

### Spec before code

Each issue contains:

- user story;
- constraints;
- acceptance criteria;
- non-goals;
- data changes;
- tests;
- observability;
- security and rights notes.

### Agent roles

- planning agent: expands issue into implementation plan;
- coding agent: implements scoped changes;
- test agent: writes missing tests and edge cases;
- review agent: checks security, architecture and regressions;
- documentation agent: updates relevant docs;
- release agent: prepares notes and deployment checklist.

Human review remains required for production changes.

### Context files

Keep these current:

- `AGENTS.md`
- `README.md`
- architecture docs;
- coding conventions;
- data dictionary;
- prompt policies;
- content-rights policy;
- test commands;
- deployment runbook.

### Prompt and eval code

Prompts and evaluations are first-class code. Changes require PR review and test results.

## Suggested labels

- `area:web`
- `area:studio`
- `area:media`
- `area:payments`
- `area:ai`
- `area:content`
- `area:rights`
- `area:infra`
- `type:feature`
- `type:bug`
- `type:security`
- `priority:p0`
- `priority:p1`
- `priority:p2`
- `blocked`
- `needs-decision`

## Environments and secrets

- GitHub environments: staging and production;
- separate provider keys;
- production deployment approval;
- no secrets in `.env.example`;
- rotate leaked secrets immediately;
- restrict payment and OpenAI keys to server/worker.

## Database migrations

- forward-only migrations;
- review generated SQL;
- separate destructive changes;
- backfill before constraint;
- deploy code compatible with old and new schema;
- remove old column in later release.

## Release workflow

1. merge to main;
2. CI passes;
3. deploy staging;
4. smoke and migration checks;
5. production approval;
6. deploy;
7. run post-deploy checks;
8. monitor;
9. rollback or roll forward;
10. record release.

## Repository access status

The GitHub application has administrator-level access to this private repository. The initial planning package is being introduced through `agent/platform-planning-blueprint` as a draft pull request.
