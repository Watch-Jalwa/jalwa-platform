import { expect } from "@playwright/test";
import { authenticatePage, ensureQaUser, qaConfig } from "../../../scripts/lib/staging-qa-auth.mjs";

export { authenticatePage, ensureQaUser, qaConfig };

export function requiredEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required for this staging Playwright test.`);
  return value;
}

export function expectedReleaseSha() {
  const value = (process.env.RELEASE_SHA ?? process.env.JALWA_EXPECTED_VERSION ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("RELEASE_SHA or JALWA_EXPECTED_VERSION must be the exact lowercase 40-character deployed Git SHA.");
  return value;
}

export async function serviceFetch(config, pathName, init = {}) {
  return fetch(`${config.supabaseUrl}${pathName}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function getActivePrice(config) {
  const response = await serviceFetch(config, "/rest/v1/prices?select=id,plan_id,code,amount_minor,currency&is_active=eq.true&order=amount_minor.asc&limit=1");
  expect(response.ok, `Active staging price lookup failed with HTTP ${response.status}.`).toBeTruthy();
  const [price] = await response.json();
  expect(price?.id, "An active staging Premium price fixture is required.").toBeTruthy();
  expect(price?.plan_id, "The active staging price must belong to a plan.").toBeTruthy();
  return price;
}

export async function checkout(page, priceId, idempotencyKey) {
  return page.evaluate(async ({ priceId, idempotencyKey }) => {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceId, idempotencyKey }),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { priceId, idempotencyKey });
}

export async function expectNoHorizontalOverflow(page, label = "page") {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth, `${label} has horizontal overflow.`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

export function watchRuntimeFailures(page, label = "page") {
  const failures = [];
  const appOrigin = new URL(page.context()._options.baseURL || page.url() || "http://localhost").origin;
  page.on("pageerror", (error) => failures.push(`${label} page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`${label} console error: ${message.text()}`);
  });
  page.on("response", (response) => {
    try {
      const url = new URL(response.url());
      if (response.status() >= 500 && url.origin === appOrigin && !url.pathname.startsWith("/api/readiness")) {
        failures.push(`${label} ${response.status()} response: ${url.pathname}`);
      }
    } catch {
      // Ignore malformed third-party URLs in diagnostics.
    }
  });
  return failures;
}

export async function expectSubscriptionAndEntitlements(config, userId, price) {
  const planResponse = await serviceFetch(config, `/rest/v1/plans?select=id,benefits&id=eq.${encodeURIComponent(price.plan_id)}`);
  expect(planResponse.ok, `Premium plan lookup failed with HTTP ${planResponse.status}.`).toBeTruthy();
  const [plan] = await planResponse.json();
  expect(Array.isArray(plan?.benefits) && plan.benefits.length > 0, "Premium plan benefits must be configured.").toBeTruthy();

  const subscriptionResponse = await serviceFetch(
    config,
    `/rest/v1/subscriptions?select=id,user_id,plan_id,provider,status,current_period_start,current_period_end&user_id=eq.${encodeURIComponent(userId)}&plan_id=eq.${encodeURIComponent(price.plan_id)}&status=eq.active&order=current_period_end.desc&limit=1`,
  );
  expect(subscriptionResponse.ok, `Active subscription lookup failed with HTTP ${subscriptionResponse.status}.`).toBeTruthy();
  const [subscription] = await subscriptionResponse.json();
  expect(subscription, "Successful payment must create or extend an active subscription.").toBeTruthy();
  expect(subscription.user_id).toBe(userId);
  expect(subscription.plan_id).toBe(price.plan_id);
  expect(subscription.status).toBe("active");
  expect(Date.parse(subscription.current_period_end)).toBeGreaterThan(Date.now());

  const entitlementResponse = await serviceFetch(
    config,
    `/rest/v1/entitlements?select=benefit_code,status,starts_at,ends_at,source_type,source_id&user_id=eq.${encodeURIComponent(userId)}&source_type=eq.subscription&source_id=eq.${encodeURIComponent(subscription.id)}`,
  );
  expect(entitlementResponse.ok, `Entitlement lookup failed with HTTP ${entitlementResponse.status}.`).toBeTruthy();
  const entitlements = await entitlementResponse.json();
  expect(Array.isArray(entitlements) && entitlements.length > 0, "Successful payment must create active subscription entitlements.").toBeTruthy();
  for (const entitlement of entitlements) {
    expect(entitlement.status).toBe("active");
    expect(entitlement.source_type).toBe("subscription");
    expect(entitlement.source_id).toBe(subscription.id);
    expect(Date.parse(entitlement.ends_at)).toBeGreaterThan(Date.now());
  }

  const expectedBenefits = [...plan.benefits].sort();
  const actualBenefits = entitlements.map((item) => item.benefit_code).sort();
  expect(actualBenefits).toEqual(expectedBenefits);
  return { subscription, entitlements };
}
