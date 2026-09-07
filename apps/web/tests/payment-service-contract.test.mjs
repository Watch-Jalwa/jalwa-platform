import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("payment service API key stays server-side and all upstream calls use X-Api-Key", async () => {
  const client = await file("apps/web/lib/payments/payment-service.ts");
  const env = await file(".env.example");
  assert.match(client, /process\.env\.PAYMENT_SERVICE_API_KEY/);
  assert.match(client, /"X-Api-Key": apiKey/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_PAYMENT_SERVICE/);
  assert.match(env, /PAYMENT_SERVICE_API_KEY=/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_PAYMENT_SERVICE_(API_KEY|WEBHOOK_SECRET)/);
});

test("wallet and subscription BFF derive user identity from the authenticated session", async () => {
  const link = await file("apps/web/app/api/payments/wallets/link/route.ts");
  const subscribe = await file("apps/web/app/api/payments/subscriptions/route.ts");
  const unlink = await file("apps/web/app/api/payments/wallets/unlink/route.ts");
  for (const route of [link, subscribe, unlink]) {
    assert.match(route, /requirePaymentUserId\(\)/);
    assert.match(route, /status: 401/);
  }
  assert.doesNotMatch(link, /body\.userId/);
  assert.doesNotMatch(subscribe, /body\.userId/);
});

test("browser sends plan code and MSISDN but never amount or API key", async () => {
  const component = await file("apps/web/components/wallet-subscribe.tsx");
  assert.match(component, /JSON\.stringify\(\{ msisdn, planCode \}\)/);
  assert.match(component, /JSON\.stringify\(\{ planCode \}\)/);
  assert.doesNotMatch(component, /amountMinor/);
  assert.doesNotMatch(component, /X-Api-Key/);
  assert.doesNotMatch(component, /MPIN.*input/i);
});

test("first wallet success is recovered through status instead of duplicate subscription creation", async () => {
  const component = await file("apps/web/components/wallet-subscribe.tsx");
  assert.match(component, /fetch\("\/api\/payments\/status"/);
  assert.match(component, /statusPayload\.alreadySubscribed/);
  assert.match(component, /linkResponse\.status === 409 && linkPayload\.error === "already_linked"/);
  assert.match(component, /window\.location\.href = "\/billing\/wallet-return\?wallet=linked"/);
});

test("subscription cancel and payment detail verify resource ownership for the signed-in user", async () => {
  const cancel = await file("apps/web/app/api/payments/subscriptions/[id]/cancel/route.ts");
  const detail = await file("apps/web/app/api/payments/history/[id]/route.ts");
  assert.match(cancel, /getPaymentServiceStatus\(userId\)/);
  assert.match(cancel, /subscriptions\.some\(\(subscription\) => subscription\.id === id\)/);
  assert.match(detail, /getPaymentServicePayments\(userId\)/);
  assert.match(detail, /payments\.some\(\(payment\) => payment\.id === id\)/);
});

test("payment service webhook is raw-body signed, bounded, typed and replay-safe", async () => {
  const route = await file("apps/web/app/api/webhooks/payment-service/route.ts");
  const reconciliation = await file("apps/web/lib/payments/payment-service-webhook.ts");
  assert.match(route, /MAX_PAYMENT_SERVICE_WEBHOOK_BYTES = 64 \* 1024/);
  assert.match(route, /const rawBody = await request\.text\(\)/);
  assert.match(route, /verifyPaymentSignature\(rawBody, request\.headers\.get\("x-payment-signature"\), secret\)/);
  assert.match(route, /request\.headers\.get\("x-payment-event"\)/);
  assert.match(route, /eventHeader !== payload\.type/);
  assert.match(reconciliation, /pg_advisory_xact_lock/);
  assert.match(reconciliation, /Conflicting payment event replay\./);
  assert.match(reconciliation, /getPaymentServiceStatus\(event\.userId\)/);
  assert.match(reconciliation, /getPaymentServicePlans\(\)/);
});

test("entitlements come from authoritative remote subscription state, including trial and step charge", async () => {
  const reconciliation = await file("apps/web/lib/payments/payment-service-webhook.ts");
  assert.match(reconciliation, /subscription\.status === "trialing"/);
  assert.match(reconciliation, /status\.status\.current_period_paid/);
  assert.match(reconciliation, /subscription\.charge_tier/);
  assert.match(reconciliation, /insert into public\.entitlements/);
  assert.match(reconciliation, /status='revoked'/);
  assert.doesNotMatch(reconciliation, /wallet=linked.*grant/i);
});

test("wallet return polls authoritative Jalwa APIs and does not trust redirect parameters", async () => {
  const poller = await file("apps/web/components/payment-status-poller.tsx");
  const page = await file("apps/web/app/billing/wallet-return/page.tsx");
  assert.match(poller, /fetch\("\/api\/payments\/wallets"/);
  assert.match(poller, /fetch\("\/api\/payments\/status"/);
  assert.match(poller, /statusResponse\.status === 429/);
  assert.match(poller, /Do not start another payment/);
  assert.doesNotMatch(poller, /URLSearchParams|searchParams|get\("subscriptionStatus"\)/);
  assert.match(page, /PaymentStatusPoller/);
});

test("v1 customer UX keeps cancel and wallet unlink separate and omits pause, switch and charge-now controls", async () => {
  const billing = await file("apps/web/app/billing/page.tsx");
  assert.match(billing, /Stop renewal/);
  assert.match(billing, /Unlink wallet & stop future debits/);
  assert.doesNotMatch(billing, />Charge now</);
  assert.doesNotMatch(billing, />Pause</);
  assert.doesNotMatch(billing, />Switch plan</);
});
