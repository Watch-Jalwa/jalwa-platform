# Security Policy

## Supported version

Jalwa is pre-launch. Security fixes are applied to the latest commit on `main` and then promoted through the production release workflow. Older branches, preview deployments and locally modified installations are not supported security releases.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Use the repository **Security** tab and create a private security advisory. Include:

- the affected URL, API route, component or workflow;
- the impact and realistic attack scenario;
- reproducible steps or a minimal proof of concept;
- any required account role or feature flag;
- suggested remediation, when available.

Do not include real customer data, production secrets, access tokens or payment credentials in the report.

## Response targets

The maintainers aim to:

- acknowledge a complete report within two business days;
- assess severity and containment requirements within five business days;
- prioritize actively exploited, authentication, authorization, payment, privacy and remote-code-execution issues immediately;
- coordinate disclosure only after a fix or effective mitigation is available.

These are operational targets rather than contractual guarantees.

## Safe research boundaries

Good-faith testing must avoid:

- denial of service, resource exhaustion or automated high-volume traffic;
- accessing, changing or deleting another person's data;
- social engineering, phishing or attacks against staff and suppliers;
- testing payment providers, SMS providers or other third parties without their authorization;
- persistence, lateral movement or continued access after demonstrating the issue.

Stop testing and report immediately if sensitive data, credentials or unintended administrative access becomes visible.

## Security-sensitive architecture

Jalwa treats the following as high-risk boundaries:

- Supabase service-role credentials and PostgreSQL privileges;
- payment checkout adapters and signed webhook processing;
- media signing, DRM packaging and Cloudflare R2 credentials;
- AI provider credentials, quotas and audit records;
- account export and deletion processing;
- production SSH, GHCR deployment tokens, backups and restore operations.

Changes to these boundaries require review, automated checks and production acceptance evidence before release.
