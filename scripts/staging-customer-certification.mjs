#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "@playwright/test";
import { authenticatePage, ensureQaUser, qaConfig } from "./lib/staging-qa-auth.mjs";

const evidenceDir = process.env.CERTIFICATION_EVIDENCE_DIR || "/tmp/jalwa-staging-certification";
const customerEmail = (process.env.STAGING_QA_CUSTOMER_EMAIL ?? "").trim();
const qaRunId = process.env.QA_RUN_ID || `local-${Date.now()}`;

function blocked(message) {
  console.error(message);
  process.exitCode = 2;
}

async function serviceFetch(config, pathName) {
  return fetch(`${config.supabaseUrl}${pathName}`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
}

async function checkout(page, priceId, idempotencyKey) {
  return page.evaluate(async ({ priceId, idempotencyKey }) => {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceId, idempotencyKey }),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { priceId, idempotencyKey });
}

async function assertSubscriptionAndEntitlements(config, userId, price) {
  const planResponse = await serviceFetch(config, `/rest/v1/plans?select=id,benefits&id=eq.${encodeURIComponent(price.plan_id)}`);
  if (!planResponse.ok) throw new Error(`Premium plan lookup failed with HTTP ${planResponse.status}.`);
  const [plan] = await planResponse.json();
  if (!plan?.id || !Array.isArray(plan.benefits) || plan.benefits.length === 0) throw new Error("Premium plan benefits are unavailable for entitlement verification.");

  const subscriptionResponse = await serviceFetch(
    config,
    `/rest/v1/subscriptions?select=id,user_id,plan_id,provider,status,current_period_start,current_period_end&user_id=eq.${encodeURIComponent(userId)}&plan_id=eq.${encodeURIComponent(price.plan_id)}&status=eq.active&order=current_period_end.desc&limit=1`,
  );
  if (!subscriptionResponse.ok) throw new Error(`Active subscription lookup failed with HTTP ${subscriptionResponse.status}.`);
  const [subscription] = await subscriptionResponse.json();
  if (!subscription) throw new Error("Successful payment did not create or extend an active subscription.");
  if (subscription.user_id !== userId || subscription.plan_id !== price.plan_id || subscription.provider !== "mock" || subscription.status !== "active") {
    throw new Error("Active subscription does not correlate with the QA customer, Premium plan and staging payment provider.");
  }
  if (!subscription.current_period_end || Date.parse(subscription.current_period_end) <= Date.now()) throw new Error("Active subscription has no valid future period end.");

  const entitlementResponse = await serviceFetch(
    config,
    `/rest/v1/entitlements?select=benefit_code,status,starts_at,ends_at,source_type,source_id&user_id=eq.${encodeURIComponent(userId)}&source_type=eq.subscription&source_id=eq.${encodeURIComponent(subscription.id)}`,
  );
  if (!entitlementResponse.ok) throw new Error(`Entitlement lookup failed with HTTP ${entitlementResponse.status}.`);
  const entitlements = await entitlementResponse.json();
  if (!Array.isArray(entitlements) || entitlements.length === 0) throw new Error("Successful payment produced no subscription entitlements.");
  for (const entitlement of entitlements) {
    if (entitlement.status !== "active" || entitlement.source_type !== "subscription" || entitlement.source_id !== subscription.id) {
      throw new Error("Subscription entitlement is not active or is correlated to the wrong source.");
    }
    if (!entitlement.ends_at || Date.parse(entitlement.ends_at) <= Date.now()) throw new Error("Subscription entitlement has no valid future expiry.");
  }

  const expectedBenefits = [...plan.benefits].sort();
  const actualBenefits = entitlements.map((item) => item.benefit_code).sort();
  if (JSON.stringify(actualBenefits) !== JSON.stringify(expectedBenefits)) {
    throw new Error("Active subscription entitlements do not exactly match the configured Premium plan benefits.");
  }

  return { subscription, entitlements };
}

async function main() {
  if (!customerEmail) return blocked("BLOCKED: STAGING_QA_CUSTOMER_EMAIL is not configured in the protected staging environment.");

  let config;
  try { config = qaConfig(); }
  catch (error) { return blocked(`BLOCKED: ${error.message}`); }

  await mkdir(evidenceDir, { recursive: true });
  const user = await ensureQaUser(config, customerEmail);

  const priceResponse = await serviceFetch(config, "/rest/v1/prices?select=id,plan_id,code,amount_minor,currency&is_active=eq.true&order=amount_minor.asc&limit=1");
  if (!priceResponse.ok) return blocked(`BLOCKED: active staging price lookup failed with HTTP ${priceResponse.status}.`);
  const [price] = await priceResponse.json();
  if (!price?.id || !price?.plan_id) return blocked("BLOCKED: no active staging Premium price fixture exists.");

  const browser = await chromium.launch({ headless: true });
  try {
    const anonymous = await browser.newContext({ baseURL: config.baseUrl });
    const anonymousCheckout = await anonymous.request.post(`${config.baseUrl}/api/checkout`, { data: { priceId: price.id, idempotencyKey: `AUTO-QA-${qaRunId}-anonymous` } });
    if (anonymousCheckout.status() !== 401) throw new Error(`Unauthenticated checkout returned HTTP ${anonymousCheckout.status()} instead of 401.`);
    await anonymous.close();

    const desktop = await browser.newContext({ baseURL: config.baseUrl });
    const page = await desktop.newPage();
    await authenticatePage(page, config, user.email, "/pricing");
    await page.goto(`${config.baseUrl}/pricing`, { waitUntil: "networkidle" });
    if (!(await page.locator(".checkout-button").first().isVisible())) throw new Error("Premium checkout control is not visible to the authenticated QA customer.");

    const missingPrice = await page.evaluate(async () => {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      return response.status;
    });
    if (missingPrice !== 400) throw new Error(`Missing-price checkout returned HTTP ${missingPrice} instead of 400.`);
    const invalidPrice = await checkout(page, "00000000-0000-4000-8000-000000000000", `AUTO-QA-${qaRunId}-invalid-price`);
    if (invalidPrice.status !== 400) throw new Error(`Invalid-price checkout returned HTTP ${invalidPrice.status} instead of 400.`);

    const idempotencyKey = `AUTO-QA-${qaRunId}-duplicate`;
    const [first, second] = await Promise.all([
      checkout(page, price.id, idempotencyKey),
      checkout(page, price.id, idempotencyKey),
    ]);
    if (first.status !== 200 || second.status !== 200) throw new Error(`Duplicate checkout requests returned HTTP ${first.status}/${second.status}.`);
    if (!first.body?.orderId || first.body.orderId !== second.body?.orderId) throw new Error("Duplicate checkout requests created different order IDs.");
    if (first.body.redirectUrl !== second.body.redirectUrl) throw new Error("Duplicate checkout requests produced different provider checkout references.");

    const orderResponse = await serviceFetch(config, `/rest/v1/checkout_orders?select=id,user_id,amount_minor,currency,status&id=eq.${encodeURIComponent(first.body.orderId)}`);
    if (!orderResponse.ok) throw new Error(`Authoritative checkout lookup failed with HTTP ${orderResponse.status}.`);
    const [order] = await orderResponse.json();
    if (!order) throw new Error("Checkout order was not persisted.");
    if (order.user_id !== user.id) throw new Error("Checkout order belongs to the wrong user.");
    if (Number(order.amount_minor) !== Number(price.amount_minor) || order.currency !== price.currency) throw new Error("Checkout amount/currency differs from the authoritative price.");

    await page.goto(first.body.redirectUrl, { waitUntil: "networkidle" });
    if (!(await page.getByRole("heading", { name: "Confirm Jalwa Premium" }).isVisible())) throw new Error("Mock staging checkout page did not render.");
    await page.screenshot({ path: path.join(evidenceDir, "customer-checkout-desktop.png"), fullPage: true });
    await Promise.all([
      page.waitForURL(/\/billing\/success\?order=/),
      page.getByRole("button", { name: "Complete test payment" }).click(),
    ]);
    if (!(await page.getByText(/Premium|payment|subscription/i).first().isVisible().catch(() => false))) throw new Error("Billing success page did not expose a success state.");

    const paidResponse = await serviceFetch(config, `/rest/v1/checkout_orders?select=id,amount_minor,currency,status&id=eq.${encodeURIComponent(first.body.orderId)}`);
    const [paidOrder] = paidResponse.ok ? await paidResponse.json() : [];
    if (!paidOrder || paidOrder.status !== "succeeded") throw new Error("Successful staging payment did not produce an authoritative succeeded checkout order.");
    if (Number(paidOrder.amount_minor) !== Number(price.amount_minor) || paidOrder.currency !== price.currency) throw new Error("Succeeded order amount/currency changed after checkout.");
    const desktopEntitlementState = await assertSubscriptionAndEntitlements(config, user.id, price);

    const mobile = await browser.newContext({ ...devices["Pixel 7"], baseURL: config.baseUrl });
    const mobilePage = await mobile.newPage();
    await authenticatePage(mobilePage, config, user.email, "/pricing");
    await mobilePage.goto(`${config.baseUrl}/pricing`, { waitUntil: "networkidle" });
    const mobileCheckout = await checkout(mobilePage, price.id, `AUTO-QA-${qaRunId}-mobile`);
    if (mobileCheckout.status !== 200 || !mobileCheckout.body?.redirectUrl || !mobileCheckout.body?.orderId) throw new Error(`Mobile checkout creation failed with HTTP ${mobileCheckout.status}.`);
    await mobilePage.goto(mobileCheckout.body.redirectUrl, { waitUntil: "networkidle" });
    if (!(await mobilePage.getByRole("button", { name: "Complete test payment" }).isVisible())) throw new Error("Mobile purchase journey did not reach the hosted mock checkout.");
    await mobilePage.screenshot({ path: path.join(evidenceDir, "customer-checkout-mobile.png"), fullPage: true });
    await Promise.all([
      mobilePage.waitForURL(/\/billing\/success\?order=/),
      mobilePage.getByRole("button", { name: "Complete test payment" }).click(),
    ]);
    const mobilePaidResponse = await serviceFetch(config, `/rest/v1/checkout_orders?select=id,status,amount_minor,currency&id=eq.${encodeURIComponent(mobileCheckout.body.orderId)}`);
    const [mobilePaidOrder] = mobilePaidResponse.ok ? await mobilePaidResponse.json() : [];
    if (!mobilePaidOrder || mobilePaidOrder.status !== "succeeded") throw new Error("Mobile purchase did not reach authoritative succeeded state.");
    if (Number(mobilePaidOrder.amount_minor) !== Number(price.amount_minor) || mobilePaidOrder.currency !== price.currency) throw new Error("Mobile succeeded order amount/currency differs from the authoritative price.");
    const mobileEntitlementState = await assertSubscriptionAndEntitlements(config, user.id, price);
    await mobile.close();
    await desktop.close();

    const evidence = {
      schema_version: 1,
      qa_run_id: qaRunId,
      supported_checkout: "authenticated-premium-subscription",
      provider: "mock",
      negative_boundaries: ["unauthenticated checkout denied", "missing price denied", "invalid price denied"],
      duplicate_order_id: first.body.orderId,
      authoritative_amount_minor: Number(price.amount_minor),
      authoritative_currency: price.currency,
      payment_status: paidOrder.status,
      subscription_id: desktopEntitlementState.subscription.id,
      entitlement_count: desktopEntitlementState.entitlements.length,
      entitlement_benefits: desktopEntitlementState.entitlements.map((item) => item.benefit_code).sort(),
      mobile_subscription_id: mobileEntitlementState.subscription.id,
      desktop_purchase: "PASS",
      mobile_purchase: "PASS",
      guest_cart_checkout: "N/A",
      delivery: "N/A",
      takeaway: "N/A",
      product_cart: "N/A",
      provider_states_not_supported_by_mock_adapter: ["pending", "cancel", "timeout"],
      recorded_at: new Date().toISOString(),
    };
    await writeFile(path.join(evidenceDir, "customer-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log("Authenticated Premium checkout, negative auth/input boundaries, idempotency, authoritative pricing, mock payment, subscription entitlements, and full mobile purchase path passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Customer staging certification failed: ${error.message}`);
  process.exitCode = 1;
});
