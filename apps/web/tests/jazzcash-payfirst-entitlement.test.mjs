import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const billingUrl = new URL("../lib/payments/jazzcash-landing-billing.mjs", import.meta.url);
const v11Url = new URL("../lib/payments/jazzcash-v11.mjs", import.meta.url);
const migrationUrl = new URL("../../../database/migrations/202611050001_jazzcash_pay_via_token_entitlement.sql", import.meta.url);

test("pay-first complete path charges via token then grants local Premium", async () => {
  const billing = await readFile(billingUrl, "utf8");
  assert.match(billing, /payViaJazzcashToken/);
  assert.match(billing, /grantPremiumForJazzcashIntent/);
  assert.match(billing, /chargeAndGrantJazzcashIntent/);
  assert.match(billing, /reconcileJazzcashPremiumForUser/);
  assert.match(billing, /mockJazzcashChargeAllowed/);
  assert.match(billing, /DEPLOYMENT_ENVIRONMENT === "staging"/);
  assert.match(billing, /transferJazzcashSubscriptionToUser/);
  assert.match(billing, /same-number sign-in/);
  assert.match(billing, /72 hours/);
  assert.match(billing, /subscription_id is not null and user_id is distinct from/);
  assert.match(billing, /premium_catalogue/);
  assert.match(billing, /amountMinor', \$7::bigint/);
  assert.match(billing, /insert into public\.subscriptions/);
  assert.match(billing, /insert into public\.entitlements/);
  assert.match(billing, /Premium activated for this JazzCash number/);
  assert.doesNotMatch(billing, /For direct JazzCash v11 sandbox returns we mark the intent completed/);
});

test("profile reloads reconcile JazzCash Premium onto the signed-in account", async () => {
  const profileUrl = new URL("../app/profile/page.tsx", import.meta.url);
  const profile = await readFile(profileUrl, "utf8");
  assert.match(profile, /reconcileJazzcashPremiumForUser/);
});

test("PayViaToken helper posts signed m-wallet payload without MPIN", async () => {
  const source = await readFile(v11Url, "utf8");
  assert.match(source, /jazzcashPayViaTokenUrl/);
  assert.match(source, /payment-orchestrator\/api\/v4\/rest\/payments\/m-wallet/);
  assert.match(source, /pp_PaymentToken/);
  assert.doesNotMatch(source, /pp_MPIN/);
  assert.doesNotMatch(source, /pp_CNIC/);
});

test("migration tracks charge txn and aligns monthly price to Rs 599", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /payment_token/);
  assert.match(migration, /charge_txn_ref/);
  assert.match(migration, /subscription_id/);
  assert.match(migration, /amount_minor = 59900/);
  assert.match(migration, /premium-monthly-pkr/);
});

test("phone signup/signin reconciles pending JazzCash Premium onto the same number", async () => {
  const loginUrl = new URL("../lib/auth/password-login.mjs", import.meta.url);
  const login = await readFile(loginUrl, "utf8");
  assert.match(login, /reconcileJazzcashPremiumForUser/);
});
