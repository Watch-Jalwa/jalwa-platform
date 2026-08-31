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

export async function qaFetch(config, kind, params = {}) {
  const query = new URLSearchParams({ kind, ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) });
  return fetch(`${config.baseUrl}/api/internal/qa/state?${query}`, { headers: { "x-jalwa-qa-token": config.qaSecret } });
}

export async function getActivePrice(config) {
  const response = await qaFetch(config, "active-price");
  expect(response.ok, `Active staging price lookup failed with HTTP ${response.status}.`).toBeTruthy();
  const { data: price } = await response.json();
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
  const baseUrl = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "http://localhost").trim();
  const appOrigin = new URL(baseUrl).origin;
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
  const planResponse = await qaFetch(config, "plan", { id: price.plan_id });
  expect(planResponse.ok, `Premium plan lookup failed with HTTP ${planResponse.status}.`).toBeTruthy();
  const { data: plan } = await planResponse.json();
  expect(Array.isArray(plan?.benefits) && plan.benefits.length > 0, "Premium plan benefits must be configured.").toBeTruthy();

  const stateResponse = await qaFetch(config, "subscription-entitlements", { userId, planId: price.plan_id });
  expect(stateResponse.ok, `Subscription/entitlement lookup failed with HTTP ${stateResponse.status}.`).toBeTruthy();
  const { data } = await stateResponse.json();
  const subscription = data?.subscription;
  const entitlements = data?.entitlements ?? [];
  expect(subscription, "Successful payment must create or extend an active subscription.").toBeTruthy();
  expect(subscription.user_id).toBe(userId);
  expect(subscription.plan_id).toBe(price.plan_id);
  expect(subscription.status).toBe("active");
  if ((process.env.ALLOW_MOCK_PAYMENTS ?? "true") === "true") expect(subscription.provider).toBe("mock");
  expect(Date.parse(subscription.current_period_end)).toBeGreaterThan(Date.now());
  expect(Array.isArray(entitlements) && entitlements.length > 0, "Successful payment must create active subscription entitlements.").toBeTruthy();
  for (const entitlement of entitlements) {
    expect(entitlement.status).toBe("active");
    expect(entitlement.source_type).toBe("subscription");
    expect(entitlement.source_id).toBe(subscription.id);
    expect(Date.parse(entitlement.ends_at)).toBeGreaterThan(Date.now());
  }
  expect(entitlements.map((item) => item.benefit_code).sort()).toEqual([...plan.benefits].sort());
  return { subscription, entitlements };
}
