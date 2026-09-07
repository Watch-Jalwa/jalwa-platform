import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("payment-service finance projection stores only sanitized authoritative payment fields", async () => {
  const migration = await file("database/migrations/202609070001_payment_service_finance_projection.sql");
  assert.match(migration, /create table public\.payment_service_payments/);
  assert.match(migration, /remote_payment_id text not null/);
  assert.match(migration, /amount_minor integer not null/);
  assert.match(migration, /charge_kind text/);
  assert.match(migration, /status in \('pending','completed','failed','expired','refunded'\)/);
  assert.match(migration, /finance payment service payments read/);
  assert.match(migration, /role in \('finance','admin'\)/);
  const tableDefinition = migration.match(/create table public\.payment_service_payments \(([\s\S]*?)\n\);/)?.[1] ?? "";
  assert.ok(tableDefinition, "payment_service_payments table definition must be present");
  assert.doesNotMatch(tableDefinition, /pp_paymenttoken|pp_password|pp_securehash|\bmpin\b/i);
  assert.match(migration, /No JazzCash wallet token, MPIN, merchant password or secure hash is stored/);
});

test("signed payment-service events reconcile authoritative payment history into Finance", async () => {
  const reconciliation = await file("apps/web/lib/payments/payment-service-webhook.ts");
  assert.match(reconciliation, /getPaymentServicePayments\(event\.userId\)/);
  assert.match(reconciliation, /PAYMENT_HISTORY_EVENTS/);
  assert.match(reconciliation, /insert into public\.payment_service_payments/);
  assert.match(reconciliation, /on conflict\(provider,remote_payment_id\) do update/);
  assert.match(reconciliation, /response_message=excluded\.response_message/);
  assert.match(reconciliation, /payments_reconciled/);
  assert.match(reconciliation, /boundedText\(payment\.response_message, 1000\)/);
});

test("remote subscription projection records authoritative price and recurring-consent snapshots", async () => {
  const reconciliation = await file("apps/web/lib/payments/payment-service-webhook.ts");
  assert.match(reconciliation, /auto_renew_consented=/);
  assert.match(reconciliation, /price_snapshot=jsonb_build_object/);
  assert.match(reconciliation, /subscription\.amount_minor/);
  assert.match(reconciliation, /subscription\.step_amount_minor/);
  assert.match(reconciliation, /subscription\.interval/);
});

test("Studio Finance exposes the reconciled payment-service ledger under staff authorization", async () => {
  const page = await file("apps/web/app/studio/finance/page.tsx");
  assert.match(page, /requireStaff\(\)/);
  assert.match(page, /profile\.role !== "finance" && profile\.role !== "admin"/);
  assert.match(page, /database\.from\("payment_service_payments"\)/);
  assert.match(page, /Payment-service transactions/);
  assert.match(page, /sanitized local projection of the authoritative payment-service history/);
});

test("aggregate reports do not invent undocumented remote payment-to-subscription links", async () => {
  const docs = await file("docs/29-payment-service-wallet-subscriptions.md");
  assert.match(docs, /does not provide that linkage/);
  assert.match(docs, /not inference/);
});
