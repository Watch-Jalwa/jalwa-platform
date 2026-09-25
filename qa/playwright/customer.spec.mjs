import { test, expect, devices } from "@playwright/test";
import {
  authenticatePage,
  checkout,
  expectNoHorizontalOverflow,
  expectSubscriptionAndEntitlements,
  getActivePrice,
  qaConfig,
  qaFetch,
  qaPremiumFixtures,
} from "./helpers/staging.mjs";

const customerEmail = (process.env.STAGING_QA_CUSTOMER_EMAIL ?? "").trim();
const baseRunId = process.env.QA_RUN_ID ?? `customer-${Date.now()}`;
const runAttempt = process.env.GITHUB_RUN_ATTEMPT?.trim();
const runId = `${baseRunId}${runAttempt ? `-attempt-${runAttempt}` : ""}`.slice(0, 120);
const config = qaConfig();

let customer;
let freeCustomer;
let price;

function qaSiblingEmail(email, suffix) {
  const at = email.lastIndexOf("@");
  if (at < 1) throw new Error("Invalid QA customer email.");
  return `${email.slice(0, at)}+${suffix}-${runId.slice(-12)}${email.slice(at)}`;
}

async function playbackToken(page, contentId, deviceKey = "") {
  return page.evaluate(async ({ contentId, deviceKey }) => {
    const response = await fetch(`/api/playback/${contentId}/token`, {
      method: "POST",
      headers: deviceKey ? { "x-jalwa-device-key": deviceKey } : {},
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, { contentId, deviceKey });
}

test.describe.serial("authenticated Premium customer", () => {
  test.beforeAll(async () => {
    if (!customerEmail) throw new Error("STAGING_QA_CUSTOMER_EMAIL is required for customer certification.");
    const helpers = await import("./helpers/staging.mjs");
    customer = await helpers.ensureQaUser(config, customerEmail, "subscriber");
    freeCustomer = await helpers.ensureQaUser(config, qaSiblingEmail(customerEmail, "premium-free"), "subscriber");
    price = await getActivePrice(config);
    const fixture = await qaPremiumFixtures(config, "POST", { premiumUserId: customer.id, freeUserId: freeCustomer.id });
    expect(fixture.ok, `Premium fixture setup failed with HTTP ${fixture.status}.`).toBeTruthy();
  });

  test.afterAll(async () => {
    const cleanup = await qaPremiumFixtures(config, "DELETE");
    expect(cleanup.ok, `Premium fixture cleanup failed with HTTP ${cleanup.status}.`).toBeTruthy();
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


  test("Premium catalogue access is denied free and allowed after Premium activation", async ({ browser }) => {
    const freeContext = await browser.newContext({ baseURL: config.baseUrl });
    const premiumContext = await browser.newContext({ baseURL: config.baseUrl });
    try {
      const freePage = await freeContext.newPage();
      await authenticatePage(freePage, config, freeCustomer.email, "/premium");
      const denied = await playbackToken(freePage, "00000000-0000-4000-8000-00000000a101", "qa-free-premium-device");
      expect(denied.status).toBe(402);
      expect(denied.body?.code).toBe("payment_required");

      const premiumPage = await premiumContext.newPage();
      await authenticatePage(premiumPage, config, customer.email, "/premium");
      const allowed = await playbackToken(premiumPage, "00000000-0000-4000-8000-00000000a101", "qa-paid-premium-device");
      expect(allowed.status).toBe(200);
      expect(allowed.body?.qualityTier).toBe("enhanced");
    } finally {
      await freeContext.close();
      await premiumContext.close();
    }
  });

  test("early access Original is hidden free and visible to Premium", async ({ browser }) => {
    const freeContext = await browser.newContext({ baseURL: config.baseUrl });
    const premiumContext = await browser.newContext({ baseURL: config.baseUrl });
    try {
      const freePage = await freeContext.newPage();
      await authenticatePage(freePage, config, freeCustomer.email, "/premium");
      const freeResponse = await freePage.goto("/watch/qa-premium-early-access-original", { waitUntil: "domcontentloaded" });
      expect(freeResponse?.status()).toBe(404);

      const premiumPage = await premiumContext.newPage();
      await authenticatePage(premiumPage, config, customer.email, "/premium");
      const paidResponse = await premiumPage.goto("/watch/qa-premium-early-access-original", { waitUntil: "domcontentloaded" });
      expect(paidResponse?.status()).toBe(200);
      const earlyPlayback = await playbackToken(premiumPage, "00000000-0000-4000-8000-00000000a102", "qa-paid-early-access-device");
      expect(earlyPlayback.status).toBe(200);
      expect(earlyPlayback.body?.qualityTier).toBe("enhanced");
      await expect(premiumPage.locator("body")).toContainText("Early access");
      await expect(premiumPage.locator("body")).toContainText("QA Early Access Jalwa Original");
      await premiumPage.goto("/premium", { waitUntil: "networkidle" });
      await expect(premiumPage.getByTestId("premium-early-access")).toContainText("QA Early Access Jalwa Original");
    } finally {
      await freeContext.close();
      await premiumContext.close();
    }
  });

  test("ad-free interface removes Jalwa promotion for Premium", async ({ browser }) => {
    const freeContext = await browser.newContext({ baseURL: config.baseUrl });
    const premiumContext = await browser.newContext({ baseURL: config.baseUrl });
    try {
      const freePage = await freeContext.newPage();
      await authenticatePage(freePage, config, freeCustomer.email, "/");
      await freePage.goto("/", { waitUntil: "networkidle" });
      await expect(freePage.getByTestId("jalwa-ad-slot")).toBeVisible();

      const premiumPage = await premiumContext.newPage();
      await authenticatePage(premiumPage, config, customer.email, "/");
      await premiumPage.goto("/", { waitUntil: "networkidle" });
      await expect(premiumPage.getByTestId("jalwa-ad-slot")).toHaveCount(0);
    } finally {
      await freeContext.close();
      await premiumContext.close();
    }
  });

  test("enhanced playback quality caps free at 480p and unlocks full ladder for Premium", async ({ browser }) => {
    const freeContext = await browser.newContext({ baseURL: config.baseUrl });
    const premiumContext = await browser.newContext({ baseURL: config.baseUrl });
    try {
      const freePage = await freeContext.newPage();
      await authenticatePage(freePage, config, freeCustomer.email, "/");
      const standard = await playbackToken(freePage, "00000000-0000-4000-8000-00000000a103");
      expect(standard.status).toBe(200);
      expect(standard.body?.qualityTier).toBe("standard");
      expect(standard.body?.maxQualityHeight).toBe(480);
      expect(standard.body?.url).toContain("/480p/index.m3u8");
      const standardToken = new URL(standard.body.url).searchParams.get("token");
      expect(standardToken).toBeTruthy();
      const standardPayload = JSON.parse(Buffer.from(standardToken.split(".")[0], "base64url").toString("utf8"));
      expect(standardPayload.pathPrefix).toMatch(/\/480p\/$/);

      const premiumPage = await premiumContext.newPage();
      await authenticatePage(premiumPage, config, customer.email, "/");
      const enhanced = await playbackToken(premiumPage, "00000000-0000-4000-8000-00000000a103");
      expect(enhanced.status).toBe(200);
      expect(enhanced.body?.qualityTier).toBe("enhanced");
      expect(enhanced.body?.maxQualityHeight).toBe(720);
      expect(enhanced.body?.url).toContain("/master.m3u8");
      const enhancedToken = new URL(enhanced.body.url).searchParams.get("token");
      expect(enhancedToken).toBeTruthy();
      const enhancedPayload = JSON.parse(Buffer.from(enhancedToken.split(".")[0], "base64url").toString("utf8"));
      expect(enhancedPayload.pathPrefix).toMatch(/00000000-b103\/$/);
      expect(enhancedPayload.pathPrefix).not.toMatch(/\/480p\/$/);
    } finally {
      await freeContext.close();
      await premiumContext.close();
    }
  });

  test("Ask Jalwa allowance shows 5 free and 50 Premium without enabling AI provider", async ({ browser }) => {
    const freeContext = await browser.newContext({ baseURL: config.baseUrl });
    const premiumContext = await browser.newContext({ baseURL: config.baseUrl });
    try {
      const freePage = await freeContext.newPage();
      await authenticatePage(freePage, config, freeCustomer.email, "/ask");
      await freePage.goto("/ask", { waitUntil: "networkidle" });
      await expect(freePage.getByTestId("ask-jalwa-allowance")).toContainText("5 questions/day");

      const premiumPage = await premiumContext.newPage();
      await authenticatePage(premiumPage, config, customer.email, "/ask");
      await premiumPage.goto("/ask", { waitUntil: "networkidle" });
      await expect(premiumPage.getByTestId("ask-jalwa-allowance")).toContainText("50 questions/day");
    } finally {
      await freeContext.close();
      await premiumContext.close();
    }
  });

  test("Premium collections stay locked free and render for Premium", async ({ browser }) => {
    const freeContext = await browser.newContext({ baseURL: config.baseUrl });
    const premiumContext = await browser.newContext({ baseURL: config.baseUrl });
    try {
      const freePage = await freeContext.newPage();
      await authenticatePage(freePage, config, freeCustomer.email, "/premium");
      await freePage.goto("/premium", { waitUntil: "networkidle" });
      await expect(freePage.locator('[data-benefit-code="premium_collections"]')).toHaveAttribute("data-benefit-state", "locked");
      await expect(freePage.locator("body")).not.toContainText("QA Premium Collection");

      const premiumPage = await premiumContext.newPage();
      await authenticatePage(premiumPage, config, customer.email, "/premium");
      await premiumPage.goto("/premium", { waitUntil: "networkidle" });
      await expect(premiumPage.locator('[data-benefit-code="premium_collections"]')).toHaveAttribute("data-benefit-state", "unlocked");
      await expect(premiumPage.getByTestId("premium-collections")).toContainText("QA Premium Collection");
      await expect(premiumPage.getByTestId("premium-collections")).toContainText("QA Premium Catalogue Title");
    } finally {
      await freeContext.close();
      await premiumContext.close();
    }
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
