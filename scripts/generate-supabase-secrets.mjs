#!/usr/bin/env node
import { createHmac, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

function base64urlJson(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function secret() { return randomBytes(48).toString("base64url"); }

export function signRoleToken(role, secretValue, now = Math.floor(Date.now() / 1000)) {
  const header = base64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64urlJson({ role, iss: "supabase", iat: now, exp: now + 10 * 365 * 24 * 60 * 60 });
  const body = `${header}.${payload}`;
  const signature = createHmac("sha256", secretValue).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function generateSelfHostedSecrets() {
  const jwtSecret = secret();
  return {
    SELF_HOSTED_POSTGRES_PASSWORD: randomBytes(32).toString("base64url"),
    SELF_HOSTED_SUPABASE_JWT_SECRET: jwtSecret,
    SELF_HOSTED_SUPABASE_ANON_KEY: signRoleToken("anon", jwtSecret),
    SELF_HOSTED_SUPABASE_SERVICE_ROLE_KEY: signRoleToken("service_role", jwtSecret),
    SELF_HOSTED_SUPABASE_DASHBOARD_PASSWORD: randomBytes(24).toString("base64url"),
    SELF_HOSTED_SUPABASE_SECRET_KEY_BASE: randomBytes(64).toString("base64url"),
    SELF_HOSTED_SUPABASE_VAULT_ENC_KEY: randomBytes(24).toString("hex").slice(0, 32),
    SELF_HOSTED_SUPABASE_PG_META_CRYPTO_KEY: randomBytes(24).toString("hex").slice(0, 32),
    SELF_HOSTED_SUPABASE_LOGFLARE_PUBLIC_TOKEN: randomBytes(32).toString("base64url"),
    SELF_HOSTED_SUPABASE_LOGFLARE_PRIVATE_TOKEN: randomBytes(32).toString("base64url"),
    SELF_HOSTED_SUPABASE_POOLER_TENANT_ID: randomBytes(12).toString("hex"),
    RECOMMENDATION_REFRESH_SECRET: secret(),
    CRON_SECRET: secret(),
    ACCOUNT_REQUEST_PROCESSOR_SECRET: secret(),
  };
}

function main() {
  const output = generateSelfHostedSecrets();
  for (const [key, value] of Object.entries(output)) process.stdout.write(`${key}=${value}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
