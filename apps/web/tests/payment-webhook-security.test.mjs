import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/webhooks/payments/[provider]/route.ts", import.meta.url);
const webhookUrl = new URL("../lib/payments/webhook.ts", import.meta.url);
const migrationUrl = new URL("../../../database/migrations/202607310011_payment_replay_integrity.sql", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("payment webhook requests are bounded before lifecycle processing", async () => {
  const route = await text(routeUrl);
  assert.match(route, /MAX_PAYMENT_WEBHOOK_BYTES = 64 \* 1024/);
  assert.match(route, /Buffer\.byteLength\(rawBody, "utf8"\)/);
  assert.match(route, /status: 413/);
  assert.match(route, /uuidPattern\.test\(payload\.orderId\)/);
});

test("payment event IDs are serialized and conflicting replays are rejected", async () => {
  const migration = await text(migrationUrl);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(migration, /provider_event_id=p_provider_event_id/);
  assert.match(migration, /v_existing\.checkout_order_id <> p_order_id/);
  assert.match(migration, /v_existing\.provider_transaction_id <> p_provider_transaction_id/);
  assert.match(migration, /v_existing\.payload_hash <> p_payload_hash/);
  assert.match(migration, /payment event replay mismatch/);
  assert.match(migration, /revoke all on function public\.process_payment_lifecycle_event_unchecked[\s\S]*service_role/);
});

test("conflicting replays return a stable provider-facing conflict", async () => {
  const webhook = await text(webhookUrl);
  assert.match(webhook, /replayMismatch \? 409 : 400/);
  assert.match(webhook, /Conflicting payment event replay\./);
  assert.match(webhook, /Payment event rejected\./);
  assert.doesNotMatch(webhook, /status: 400, error: error\.message/);
});
