import { test, expect, devices } from "@playwright/test";
import {
  authenticatePage,
  checkout,
  ensureQaUser,
  expectSubscriptionAndEntitlements,
  getActivePrice,
  qaConfig,
  requiredEnv,
  serviceFetch,
} from "./helpers/staging.mjs";

const baseURL = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");
const runId = process.env.QA_RUN_ID || `pw-${Date.now()}`;
let config;
let customer;
let price;

test.describe.serial("authenticated Premium customer", () => {
  test.beforeAll(async () => {
    config = qaConfig();
    customer = await ensureQaUser(config, requiredEnv("STAGING_QA_CUSTOMER_EMAIL"));
    price = await getActivePrice(config);
  });

  test("anonymous checkout is denied", async ({ request }) => {
    const response = await request.post("/api/checkout", {
      data: { priceId: price.id, idempotencyKey: `AUTO-QA-${runId}-anonymous` },
    });
    expect(response.status()).toBe(401);
  });

  test("authenticated pricing rejects missing and invalid price input", async ({ page }) => {
    await authenticatePage(page, config, customer.email, "/pricing");
    await page.goto("/pricing", { waitUntil: "networkidle" });
    await expect(page.locator(".checkout-button").first()).toBeVisible();

    const missingPriceStatus = await page.evaluate(async () => {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.status;
    });
    expect(missingPriceStatus).toBe(400);

    const invalid = await checkout(page, "00000000-0000-4000-8000-000000000000", `AUTO-QA-${runId}-invalid`);
    expect(invalid.status).toBe(400);
  });

  test("duplicate checkout submission is idempotent and uses authoritative price", async ({ page }) => {
    await authenticatePage(page, config, customer.email, "/pricing");
    await page.goto("/pricing", { waitUntil: "networkidle" });

    const idempotencyKey = `AUTO-QA-${runId}-duplicate`;
    const [first, second] = await Promise.all([
      checkout(page, price.id, idempotencyKey),
      checkout(page, price.id, idempotencyKey),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body?.orderId).toBeTruthy();
    expect(second.body?.orderId).toBe(first.body.orderId);
    expect(second.body?.redirectUrl).toBe(first.body.redirectUrl);

    const orderResponse = await serviceFetch(
      config,
      `/rest/v1/checkout_orders?select=id,user_id,amount_minor,currency,status&id=eq.${encodeURIComponent(first.body.orderId)}`,
    );
    expect(orderResponse.ok).toBeTruthy();
    const [order] = await orderResponse.json();
    expect(order?.user_id).toBe(customer.id);
    expect(Number(order?.amount_minor)).toBe(Number(price.amount_minor));
    expect(order?.currency).toBe(price.currency);
  });

  test("desktop mock payment creates succeeded order, active subscription and exact entitlements", async ({ page }) => {
    expect(process.env.ALLOW_MOCK_PAYMENTS ?? "true").toBe("true");
    await authenticatePage(page, config, customer.email, "/pricing");
    await page.goto("/pricing", { waitUntil: "networkidle" });

    const created = await checkout(page, price.id, `AUTO-QA-${runId}-desktop-payment`);
    expect(created.status).toBe(200);
    expect(created.body?.orderId).toBeTruthy();
    expect(created.body?.redirectUrl).toMatch(/\/checkout\/mock\?order=/);

    await page.goto(created.body.redirectUrl, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Confirm Jalwa Premium" })).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/billing\/success\?order=/),
      page.getByRole("button", { name: "Complete test payment" }).click(),
    ]);
    await expect(page.getByText(/Premium|payment|subscription/i).first()).toBeVisible();

    const paidResponse = await serviceFetch(
      config,
      `/rest/v1/checkout_orders?select=id,user_id,amount_minor,currency,status&id=eq.${encodeURIComponent(created.body.orderId)}`,
    );
    expect(paidResponse.ok).toBeTruthy();
    const [paid] = await paidResponse.json();
    expect(paid?.status).toBe("succeeded");
    expect(paid?.user_id).toBe(customer.id);
    expect(Number(paid?.amount_minor)).toBe(Number(price.amount_minor));
    expect(paid?.currency).toBe(price.currency);

    await expectSubscriptionAndEntitlements(config, customer.id, price);
  });

  test("complete Premium purchase passes on Mobile Chromium", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL,
      locale: "en-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await authenticatePage(page, config, customer.email, "/pricing");
      await page.goto("/pricing", { waitUntil: "networkidle" });
      await expect(page.locator(".checkout-button").first()).toBeVisible();

      const created = await checkout(page, price.id, `AUTO-QA-${runId}-mobile-payment`);
      expect(created.status).toBe(200);
      expect(created.body?.orderId).toBeTruthy();
      expect(created.body?.redirectUrl).toBeTruthy();

      await page.goto(created.body.redirectUrl, { waitUntil: "networkidle" });
      await expect(page.getByRole("button", { name: "Complete test payment" })).toBeVisible();
      await Promise.all([
        page.waitForURL(/\/billing\/success\?order=/),
        page.getByRole("button", { name: "Complete test payment" }).click(),
      ]);

      const paidResponse = await serviceFetch(
        config,
        `/rest/v1/checkout_orders?select=id,status,amount_minor,currency&id=eq.${encodeURIComponent(created.body.orderId)}`,
      );
      expect(paidResponse.ok).toBeTruthy();
      const [paid] = await paidResponse.json();
      expect(paid?.status).toBe("succeeded");
      expect(Number(paid?.amount_minor)).toBe(Number(price.amount_minor));
      expect(paid?.currency).toBe(price.currency);
      await expectSubscriptionAndEntitlements(config, customer.id, price);
    } finally {
      await context.close();
    }
  });
});
