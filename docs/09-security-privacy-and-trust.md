# Security, Privacy and Trust

## Security baseline

### Authentication

- secure session cookies;
- rotating refresh tokens where used;
- email verification;
- optional social login;
- staff MFA;
- session revocation;
- rate-limited login and recovery;
- no account enumeration.

### Authorisation

Roles:

- viewer;
- subscriber;
- editor;
- rights_reviewer;
- support;
- finance;
- admin.

All studio actions require server-side role checks. Hiding a button is not authorisation.

### Payments

- hosted checkout;
- verified signatures;
- idempotency;
- amount verification;
- no card storage;
- restricted finance roles;
- payment event audit;
- secrets in a managed secret store.

### Application

- CSP;
- HSTS;
- secure headers;
- CSRF protection;
- output escaping;
- schema validation;
- parameterised SQL;
- dependency scanning;
- secret scanning;
- upload content-type validation;
- malware scan where practical;
- signed upload URLs;
- rate limits.

### Media

- private origin bucket;
- short-lived premium tokens;
- random, non-enumerable storage keys;
- no direct admin credentials in browser;
- upload size and duration limits;
- transcode in isolated worker;
- delete source uploads after retention policy where appropriate.

## Privacy

Collect only what is required:

- account identifier;
- optional mobile;
- preferences;
- watch history;
- payments and entitlement references;
- AI usage;
- support history.

Define:

- purpose;
- retention;
- deletion;
- export;
- access control;
- processor list;
- breach response.

Do not expose personal watch history to editors.

## Content trust

### Source transparency

Show:

- original provider;
- creator;
- licence;
- attribution;
- “Jalwa Original” or “Embedded from YouTube”;
- AI-generated or AI-assisted label where relevant.

### Sensitive categories

#### Deen

- scholar or qualified reviewer;
- avoid sectarian incitement;
- distinguish source text from interpretation;
- preserve Quran text exactly;
- handle corrections visibly.

#### Kissan

- source date;
- region and crop context;
- conservative claims;
- qualified review;
- no guaranteed yield or profit claims;
- explicit escalation for pesticide, veterinary and hazardous advice.

#### Health

- education, not diagnosis;
- approved sources;
- emergency redirection;
- no miracle claims.

#### Kids

- manual allowlist;
- no open comments;
- no behavioural ads in kids surfaces;
- no open-ended AI;
- age-appropriate metadata;
- parent controls later.

## Moderation workflow

- automated screening;
- editorial review;
- specialist review;
- publish;
- post-publication reporting;
- escalation;
- removal and audit.

## Legal and policy pages required before paid launch

- Terms of Use
- Privacy Notice
- Subscription Terms
- Refund and Cancellation Policy
- Content Licence and Attribution Notice
- Copyright/Takedown Procedure
- Community and AI Safety Notice
- Contact and Support
- Child/Family Safety Statement
- Cookie Notice where applicable

Have Pakistani counsel review the commercial, privacy, consumer and copyright position before launch.

## Incident response

Severity 1 examples:

- payment duplication;
- exposed credentials;
- premium bypass;
- user data exposure;
- malicious admin access;
- rights complaint against high-visibility content.

Response:

1. contain;
2. preserve evidence;
3. disable affected feature;
4. assess scope;
5. communicate internally;
6. remediate;
7. notify affected parties where required;
8. document postmortem;
9. add regression test.
