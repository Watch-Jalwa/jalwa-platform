import assert from "node:assert/strict";
import test from "node:test";
import { generateSelfHostedSecrets } from "../../../scripts/generate-database-secrets.mjs";

test("self-hosted secret generator creates strong PostgreSQL, Better Auth and QA secrets", () => {
  const secrets = generateSelfHostedSecrets();
  for (const key of [
    "SELF_HOSTED_POSTGRES_PASSWORD", "BETTER_AUTH_SECRET", "STAGING_QA_SECRET",
    "MEDIA_SIGNING_SECRET", "RATE_LIMIT_SALT", "RECOMMENDATION_REFRESH_SECRET",
    "CRON_SECRET", "ACCOUNT_REQUEST_PROCESSOR_SECRET", "ACCOUNT_DELETION_HASH_SECRET",
  ]) {
    assert.equal(typeof secrets[key], "string", `${key} must be a string`);
    assert.ok(secrets[key].length >= 40, `${key} must contain at least 40 characters`);
    assert.doesNotMatch(secrets[key], /\s/);
  }
  assert.notEqual(secrets.SELF_HOSTED_POSTGRES_PASSWORD, secrets.BETTER_AUTH_SECRET);
  assert.notEqual(secrets.BETTER_AUTH_SECRET, secrets.STAGING_QA_SECRET);
});

test("secret generator produces fresh values", () => {
  const first = generateSelfHostedSecrets();
  const second = generateSelfHostedSecrets();
  assert.notEqual(first.BETTER_AUTH_SECRET, second.BETTER_AUTH_SECRET);
  assert.notEqual(first.SELF_HOSTED_POSTGRES_PASSWORD, second.SELF_HOSTED_POSTGRES_PASSWORD);
});
