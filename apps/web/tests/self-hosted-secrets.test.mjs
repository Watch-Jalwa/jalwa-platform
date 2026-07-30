import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { generateSelfHostedSecrets, signRoleToken } from "../../../scripts/generate-supabase-secrets.mjs";

function decode(token) {
  const [header, payload, signature] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString("utf8")),
    payload: JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    body: `${header}.${payload}`,
    signature,
  };
}

test("self-hosted secret generator creates valid role tokens", () => {
  const secrets = generateSelfHostedSecrets();
  const anon = decode(secrets.SELF_HOSTED_SUPABASE_ANON_KEY);
  const service = decode(secrets.SELF_HOSTED_SUPABASE_SERVICE_ROLE_KEY);

  assert.equal(anon.header.alg, "HS256");
  assert.equal(anon.payload.role, "anon");
  assert.equal(service.payload.role, "service_role");

  const expected = createHmac("sha256", secrets.SELF_HOSTED_SUPABASE_JWT_SECRET)
    .update(anon.body)
    .digest("base64url");
  assert.equal(anon.signature, expected);
  assert.ok(secrets.SELF_HOSTED_POSTGRES_PASSWORD.length >= 40);
  assert.equal(secrets.SELF_HOSTED_SUPABASE_VAULT_ENC_KEY.length, 32);
});

test("role token signer is deterministic for a fixed timestamp", () => {
  assert.equal(signRoleToken("anon", "x".repeat(48), 1000), signRoleToken("anon", "x".repeat(48), 1000));
});
