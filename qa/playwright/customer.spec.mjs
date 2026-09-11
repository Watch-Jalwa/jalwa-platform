import { test, expect, devices } from "@playwright/test";
import {
  authenticatePage,
  checkout,
  expectNoHorizontalOverflow,
  expectSubscriptionAndEntitlements,
  getActivePrice,
  qaConfig,
  qaFetch,
} from "./helpers/staging.mjs";

const customerEmail = (process.env.STAGING_QA_CUSTOMER_EMAIL ?? "").trim();
const baseRunId = process.env.QA_RUN_ID ?? `customer-${Date.now()}`;
const runAttempt = process.env.GITHUB_RUN_ATTEMPT?.trim();
const runId = `${baseRunId}${runAttempt ? `-attempt-${runAttempt}` : ""}`.slice(0, 120);
const config = qaConfig();

let customer;
let price;

test.describe("authenticated Premium customer", () => {
  test.beforeAll(async () => {
    if (!customerEmail) throw new Error("STAGING_QA_CUSTOMER_EMAIL is required for customer certification.");
    customer = await (await import("./helpers/staging.mjs")).ensureQaUser(config, customerEmail, "subscriber");
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

    const missingPriceStatus = await page.evaluate(async () => {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: `AUTO-QA-${Date.now()}-missing` }),
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

    const orderResponse = await qaFetch(config, "checkout-order", { id: first.body.orderId });
    expect(orderResponse.ok).toBeTruthy();
    const { data: order } = await orderResponse.json();
    expect(order?.id).toBe(first.body.orderId);
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

    const mock = await page.goto(created.body.redirectUrl, { waitUntil: "networkidle" });
    expect(mock?.ok()).toBeTruthy();
    await page.getByRole("button", { name: "Complete test payment" }).click();
    await page.waitForURL(/\/billing/);
    await expect(page.locator("body")).toContainText(/Premium|Active/i);

    const orderResponse = await qaFetch(config, "checkout-order", { id: created.body.orderId });
    expect(orderResponse.ok).toBeTruthy();
    const { data: order } = await orderResponse.json();
    expect(order?.status).toBe("succeeded");
    await expectSubscriptionAndEntitlements(config, customer.id, price);
  });

  test("complete Premium purchase passes on Mobile Chromium", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL: config.baseUrl,
      locale: "en-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await authenticatePage(page, config, customer.email, "/pricing");
      await page.goto("/pricing", { waitUntil: "networkidle" });
      await expectNoHorizontalOverflow(page, "mobile pricing");
      const created = await checkout(page, price.id, `AUTO-QA-${runId}-mobile-payment`);
      expect(created.status).toBe(200);
      const mock = await page.goto(created.body.redirectUrl, { waitUntil: "networkidle" });
      expect(mock?.ok()).toBeTruthy();
      await expectNoHorizontalOverflow(page, "mobile mock checkout");
      await page.getByRole("button", { name: "Complete test payment" }).click();
      await page.waitForURL(/\/billing/);
      await expectNoHorizontalOverflow(page, "mobile billing");
      await expectSubscriptionAndEntitlements(config, customer.id, price);
    } finally {
      await context.close();
    }
  });
});
