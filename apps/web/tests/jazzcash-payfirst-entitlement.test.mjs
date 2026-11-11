import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const billingUrl = new URL("../lib/payments/jazzcash-landing-billing.mjs", import.meta.url);
const v11Url = new URL("../lib/payments/jazzcash-v11.mjs", import.meta.url);
const migrationUrl = new URL("../../../database/migrations/202611050001_jazzcash_pay_via_token_entitlement.sql", import.meta.url);
const priceMigrationUrl = new URL("../../../database/migrations/202611110002_update_monthly_price_to_990_tax_inclusive.sql", import.meta.url);

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

test("Status Inquiry helper posts only MerchantID Password TxnRefNo SecureHash", async () => {
  const source = await readFile(v11Url, "utf8");
  assert.match(source, /inquireJazzcashPaymentStatus/);
  assert.match(source, /jazzcashStatusInquiryUrl/);
  assert.match(source, /payment-orchestrator\/api\/v2\/rest\/payments\/status\/inquiry/);
  assert.match(source, /Do not send pp_Version/);
  const inquiry = source.slice(source.indexOf("export async function inquireJazzcashPaymentStatus"));
  const body = inquiry.slice(0, inquiry.indexOf("export function sanitizeJazzcashPublicPayload"));
  assert.match(body, /pp_MerchantID/);
  assert.match(body, /pp_Password/);
  assert.match(body, /pp_TxnRefNo/);
  assert.match(body, /pp_SecureHash/);
  assert.doesNotMatch(body, /pp_Version\s*:/);
});

test("Token Inquiry and Delete Token use SkillUp mobile-tokens field sets", async () => {
  const source = await readFile(v11Url, "utf8");
  assert.match(source, /jazzcashTokenInquiryUrl/);
  assert.match(source, /jazzcashTokenDeleteUrl/);
  assert.match(source, /payment-orchestrator\/payment\/api\/v1\/mobile-tokens\/inquiry/);
  assert.match(source, /payment-orchestrator\/payment\/api\/v1\/mobile-tokens\/delete/);
  assert.match(source, /inquireJazzcashPaymentToken/);
  assert.match(source, /deleteJazzcashPaymentToken/);
  assert.match(source, /pp_MobileNumber/);
  const billing = await readFile(billingUrl, "utf8");
  assert.match(billing, /unlinkJazzcashWalletForUser/);
  assert.match(billing, /deleteJazzcashPaymentToken/);
  assert.match(billing, /inquireJazzcashPaymentToken/);
});

test("IPN routes settle through the same complete path as Return URL", async () => {
  const billing = await readFile(billingUrl, "utf8");
  assert.match(billing, /handleJazzcashIpn/);
  assert.match(billing, /inquireJazzcashLandingStatus/);
  assert.match(billing, /completeJazzcashLandingLink/);
  const ipn = await readFile(new URL("../app/jazzcash/ipn/route.ts", import.meta.url), "utf8");
  const alias = await readFile(new URL("../app/account/jazzcash-ipn/route.ts", import.meta.url), "utf8");
  const inquiryRoute = await readFile(new URL("../app/api/v1/premium/billing/jazzcash-v11/inquiry/route.ts", import.meta.url), "utf8");
  assert.match(ipn, /respondToJazzcashIpn/);
  assert.match(alias, /respondToJazzcashIpn/);
  assert.match(inquiryRoute, /inquireJazzcashLandingStatus/);
});

test("migration tracks charge txn and aligns monthly price to Rs 990 inclusive of tax", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const priceMigration = await readFile(priceMigrationUrl, "utf8");
  assert.match(migration, /payment_token/);
  assert.match(migration, /charge_txn_ref/);
  assert.match(migration, /subscription_id/);
  assert.match(migration, /premium-monthly-pkr/);
  assert.match(priceMigration, /amount_minor = 99000/);
  assert.match(priceMigration, /inclusive of applicable taxes/);
});

test("phone signup/signin reconciles pending JazzCash Premium onto the same number", async () => {
  const loginUrl = new URL("../lib/auth/password-login.mjs", import.meta.url);
  const login = await readFile(loginUrl, "utf8");
  assert.match(login, /reconcileJazzcashPremiumForUser/);
});
