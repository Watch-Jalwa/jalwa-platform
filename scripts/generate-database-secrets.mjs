#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
function secret(bytes = 48) { return randomBytes(bytes).toString("base64url"); }
export function generateSelfHostedSecrets() {
  return {
    SELF_HOSTED_POSTGRES_PASSWORD: secret(36),
    BETTER_AUTH_SECRET: secret(48),
    STAGING_QA_SECRET: secret(48),
    MEDIA_SIGNING_SECRET: secret(48),
    RATE_LIMIT_SALT: secret(36),
    OBSERVABILITY_HASH_SALT: secret(36),
    OPERATIONS_DIAGNOSTICS_SECRET: secret(48),
    RECOMMENDATION_REFRESH_SECRET: secret(48),
    CRON_SECRET: secret(48),
    ACCOUNT_REQUEST_PROCESSOR_SECRET: secret(48),
    ACCOUNT_DELETION_HASH_SECRET: secret(48),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const values = generateSelfHostedSecrets();
  for (const [name, value] of Object.entries(values)) console.log(`${name}=${value}`);
}
