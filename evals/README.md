# Jalwa AI evaluations

This directory contains synthetic, version-controlled evaluation cases for AI features. It must not contain production conversations, customer identifiers, provider secrets, unpublished rights evidence or copyrighted source text copied beyond what is needed for a small synthetic fixture.

## Local gate

Run:

```bash
npm run test:ai
```

The deterministic gate validates prompt versions, prompt-injection boundaries, language coverage and evaluation-set structure without calling a paid provider.

## Staging gate

Prompt, model, retrieval, moderation or provider changes also require a live staging evaluation against the exact candidate configuration. Retain:

- prompt and model versions;
- provider and endpoint family;
- evaluation-set revision;
- pass/fail totals and failure examples;
- citation, safety, leakage, language, latency and cost results;
- approval or rollback decision.

Do not promote an AI change solely because a small unit test or Vercel build passed.
