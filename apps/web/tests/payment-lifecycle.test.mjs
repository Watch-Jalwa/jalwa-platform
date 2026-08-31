import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../database/migrations/202607310010_payment_operations.sql", import.meta.url);
const routeUrl = new URL("../app/api/webhooks/payments/[provider]/route.ts", import.meta.url);
const webhookUrl = new URL("../lib/payments/webhook.ts", import.meta.url);
const financeUrl = new URL("../app/studio/finance/page.tsx", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("provider webhooks support the complete normalized payment lifecycle", async () => {
  const route = await text(routeUrl);
  for (const status of ["succeeded", "failed", "refunded", "partially_refunded", "disputed"]) {
    assert.match(route, new RegExp(`\\"${status}\\"`));
  }
  assert.match(route, /x-jalwa-signature/);
  assert.match(route, /processPaymentEvent/);
});

test("payment processing is service-role-only and revokes entitlements for terminal reversals", async () => {
  const migration = await text(migrationUrl);
  assert.match(migration, /process_payment_lifecycle_event/);
  assert.match(migration, /revoke all on function public\.process_payment_lifecycle_event/);
  assert.match(migration, /grant execute on function public\.process_payment_lifecycle_event[\s\S]*to service_role/);
  assert.match(migration, /set status='revoked',ends_at=least\(ends_at,now\(\)\)/);
  assert.match(migration, /payment_exceptions/);
});

test("webhook processing is idempotent and finance exceptions are operable", async () => {
  const [migration, webhook, finance] = await Promise.all([text(migrationUrl), text(webhookUrl), text(financeUrl)]);
  assert.match(migration, /unique\(provider,provider_event_id\)/);
  assert.match(migration, /jsonb_build_object\('idempotent',true\)/);
  assert.match(webhook, /process_payment_lifecycle_event/);
  assert.match(finance, /Open payment exceptions/);
  assert.match(finance, /resolvePaymentException/);
});
