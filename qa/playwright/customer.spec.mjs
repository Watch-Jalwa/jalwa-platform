import { test, expect, devices } from "@playwright/test";
import {
  authenticatePage,
  checkout,
  expectNoHorizontalOverflow,
  expectSubscriptionAndEntitlements,
  getActivePrice,
  qaConfig,
  qaFetch,
  qaMutate,
} from "./helpers/staging.mjs";

const customerEmail = (process.env.STAGING_QA_CUSTOMER_EMAIL ?? "").trim();
const baseRunId = process.env.QA_RUN_ID ?? `customer-${Date.now()}`;
const runAttempt = process.env.GITHUB_RUN_ATTEMPT?.trim();
const runId = `${baseRunId}${runAttempt ? `-attempt-${runAttempt}` : ""}`.slice(0, 120);
const config = qaConfig();

let customer;
let price;
let fixture;

test.describe.serial("authenticated Premium customer", () => {
  test.beforeAll(async () => {
    if (!customerEmail) throw new Error("STAGING_QA_CUSTOMER_EMAIL is required for customer certification.");
    customer = await (await import("./helpers/staging.mjs")).ensureQaUser(config, customerEmail, "subscriber");
    price = await getActivePrice(config);
    const prepared = await qaMutate(config, "POST", "premium-benefit-fixture", { userId: customer.id });
    expect(prepared.ok, `Premium benefit fixture setup failed with HTTP ${prepared.status}.`).toBeTruthy();
    fixture = (await prepared.json()).data;
    expect(fixture?.premiumContentId).toBeTruthy();
    expect(fixture?.qualityContentId).toBeTruthy();
    expect(fixture?.earlyAccessSlug).toBeTruthy();
    expect(fixture?.premiumCollectionSlug).toBeTruthy();
  });

  test.afterAll(async () => {
    const cleaned = await qaMutate(config, "DELETE", "premium-benefit-fixture");
    expect(cleaned.ok, `Premium benefit fixture cleanup failed with HTTP ${cleaned.status}.`).toBeTruthy();
  });

  test("free tier is denied or capped across all Premium benefit boundaries", async ({ page }) => {
    await authenticatePage(page, config, customer.email, "/");

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("jalwa-ad-slot")).toBeVisible();

    const lockedCollection = await page.goto(`/collections/${fixture.premiumCollectionSlug}`, { waitUntil: "networkidle" });
    expect(lockedCollection?.status()).toBe(200);
    await expect(page.getByTestId("premium-collection-lock")).toBeVisible();

    const earlyAccess = await page.goto(`/watch/${fixture.earlyAccessSlug}`, { waitUntil: "domcontentloaded" });
    expect(earlyAccess?.status()).toBe(404);

    const standardQuality = await page.evaluate(async (contentId) => {
      const response = await fetch(`/api/playback/${contentId}/token`, { method: "POST" });
      return { status: response.status, body: await response.json() };
    }, fixture.qualityContentId);
    expect(standardQuality.status).toBe(200);
    expect(standardQuality.body.qualityTier).toBe("standard");
    expect(standardQuality.body.maxQualityHeight).toBe(480);
    expect(standardQuality.body.url).toMatch(/\/480p\/index\.m3u8\?/);

    const premiumTitle = await page.evaluate(async (contentId) => {
      const response = await fetch(`/api/playback/${contentId}/token`, {
        method: "POST",
        headers: { "x-jalwa-device-key": "qa-premium-benefit-device" },
      });
      return { status: response.status, body: await response.json() };
    }, fixture.premiumContentId);
    expect(premiumTitle.status).toBe(402);
    expect(premiumTitle.body.code).toBe("payment_required");

    await page.goto("/ask", { waitUntil: "networkidle" });
    await expect(page.getByTestId("ask-jalwa-allowance")).toContainText("Free allowance: 5 questions per day.");
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

  test("all six Premium benefits are delivered after entitlement activation", async ({ page }) => {
    await authenticatePage(page, config, customer.email, "/");

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByTestId("jalwa-ad-slot")).toHaveCount(0);

    await page.goto("/pricing", { waitUntil: "networkidle" });
    for (const label of [
      "Full authorised Jalwa catalogue",
      "Jalwa Originals and early access",
      "Ad-free Jalwa interface",
      "Enhanced playback quality",
      "Larger Ask Jalwa allowance",
      "Premium collections",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    const collection = await page.goto(`/collections/${fixture.premiumCollectionSlug}`, { waitUntil: "networkidle" });
    expect(collection?.status()).toBe(200);
    await expect(page.getByTestId("premium-collection-lock")).toHaveCount(0);
    await expect(page.getByTestId("premium-collection-content")).toContainText("QA Enhanced Quality Title");

    const earlyAccess = await page.goto(`/watch/${fixture.earlyAccessSlug}`, { waitUntil: "networkidle" });
    expect(earlyAccess?.status()).toBe(200);
    await expect(page.getByTestId("early-access-notice")).toBeVisible();

    const enhancedQuality = await page.evaluate(async (contentId) => {
      const response = await fetch(`/api/playback/${contentId}/token`, { method: "POST" });
      return { status: response.status, body: await response.json() };
    }, fixture.qualityContentId);
    expect(enhancedQuality.status).toBe(200);
    expect(enhancedQuality.body.qualityTier).toBe("premium");
    expect(enhancedQuality.body.maxQualityHeight).toBe(720);
    expect(enhancedQuality.body.url).toMatch(/\/master\.m3u8\?/);

    const premiumTitle = await page.evaluate(async (contentId) => {
      const response = await fetch(`/api/playback/${contentId}/token`, {
        method: "POST",
        headers: { "x-jalwa-device-key": "qa-premium-benefit-device" },
      });
      return { status: response.status, body: await response.json() };
    }, fixture.premiumContentId);
    expect(premiumTitle.status).toBe(200);
    expect(premiumTitle.body.qualityTier).toBe("premium");

    await page.route("**/api/media/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n",
      });
    });
    await page.goto(`/watch/${fixture.qualitySlug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("playback-quality")).toContainText("Premium · up to 720p");

    await page.goto("/ask", { waitUntil: "networkidle" });
    await expect(page.getByTestId("ask-jalwa-allowance")).toContainText("Premium allowance: 50 questions per day.");
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
