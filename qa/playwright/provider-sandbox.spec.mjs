import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { test, expect, devices } from "@playwright/test";
import {
  authenticatePage,
  checkout,
  ensureQaUser,
  expectSubscriptionAndEntitlements,
  getActivePrice,
  qaConfig,
  qaFetch,
  requiredEnv,
} from "./helpers/staging.mjs";

const baseURL = requiredEnv("STAGING_BASE_URL").replace(/\/$/, "");
const provider = requiredEnv("STAGING_PAYMENT_PROVIDER");
const expectedHost = requiredEnv("STAGING_PAYMENT_EXPECTED_HOST").toLowerCase();
const webhookSecret = requiredEnv("PAYMENT_WEBHOOK_SECRET");
const releaseSha = requiredEnv("RELEASE_SHA");
const stagingDeploymentRunId = requiredEnv("STAGING_DEPLOYMENT_RUN_ID");
const evidenceFile = process.env.PAYMENT_SANDBOX_EVIDENCE_FILE || "payment-sandbox-report.json";
const runId = process.env.QA_RUN_ID || `provider-sandbox-${Date.now()}`;
const supportedProviders = new Set(["payfast", "jazzcash", "easypaisa"]);

if (!supportedProviders.has(provider)) {
  throw new Error("STAGING_PAYMENT_PROVIDER must be payfast, jazzcash or easypaisa for production-readiness certification.");
}

let config;
let customer;
let price;
let desktopOrder;
let redirectHost;

function signature(raw) {
  return createHmac("sha256", webhookSecret).update(raw).digest("hex");
}

async function readOrder(orderId) {
  const response = await qaFetch(config, "checkout-order", { id: orderId });
  expect(response.ok).toBeTruthy();
  const rows = await response.json();
  return rows[0];
}

async function completeThroughSignedProviderWebhook(orderId, suffix) {
  const event = {
    eventId: `sandbox-${provider}-${runId}-${suffix}`,
    orderId,
    transactionId: `sandbox-txn-${runId}-${suffix}`,
    amountMinor: Number(price.amount_minor),
    currency: price.currency,
    status: "succeeded",
  };
  const raw = JSON.stringify(event);
  const response = await fetch(`${baseURL}/api/webhooks/payments/${provider}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-jalwa-signature": signature(raw),
    },
    body: raw,
  });
  const body = await response.json().catch(() => ({}));
  expect(response.status, JSON.stringify(body)).toBe(200);
  expect(body.ok).toBe(true);
}

async function assertSandboxRedirect(created) {
  expect(created.status).toBe(200);
  expect(created.body?.orderId).toBeTruthy();
  expect(created.body?.redirectUrl).toBeTruthy();
  const redirect = new URL(created.body.redirectUrl);
  expect(redirect.protocol).toBe("https:");
  expect(redirect.hostname.toLowerCase()).toBe(expectedHost);
  expect(redirect.pathname).not.toMatch(/\/checkout\/mock/);
  return redirect.hostname.toLowerCase();
}

test.describe.serial("real payment provider sandbox", () => {
  test.beforeAll(async () => {
    config = qaConfig();
    customer = await ensureQaUser(config, requiredEnv("STAGING_QA_CUSTOMER_EMAIL"));
    price = await getActivePrice(config);
  });

  test("desktop checkout reaches the configured provider sandbox and completes the signed lifecycle", async ({ page }) => {
    await authenticatePage(page, config, customer.email, "/pricing");
    await page.goto("/pricing", { waitUntil: "networkidle" });

    const created = await checkout(page, price.id, `AUTO-QA-${runId}-provider-desktop`);
    redirectHost = await assertSandboxRedirect(created);
    desktopOrder = created.body.orderId;

    const pending = await readOrder(desktopOrder);
    expect(pending?.provider).toBe(provider);
    expect(Number(pending?.amount_minor)).toBe(Number(price.amount_minor));
    expect(pending?.currency).toBe(price.currency);

    await completeThroughSignedProviderWebhook(desktopOrder, "desktop");
    const paid = await readOrder(desktopOrder);
    expect(paid?.status).toBe("succeeded");
    expect(paid?.provider).toBe(provider);
    await expectSubscriptionAndEntitlements(config, customer.id, price);
  });

  test("mobile checkout reaches the same provider sandbox", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL,
      locale: "en-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await authenticatePage(page, config, customer.email, "/pricing");
      await page.goto("/pricing", { waitUntil: "networkidle" });
      const created = await checkout(page, price.id, `AUTO-QA-${runId}-provider-mobile`);
      await assertSandboxRedirect(created);
      const order = await readOrder(created.body.orderId);
      expect(order?.provider).toBe(provider);
      expect(Number(order?.amount_minor)).toBe(Number(price.amount_minor));
      expect(order?.currency).toBe(price.currency);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async () => {
    await writeFile(evidenceFile, `${JSON.stringify({
      schema_version: 1,
      status: "PASS",
      release_sha: releaseSha,
      staging_deployment_run_id: stagingDeploymentRunId,
      provider,
      expected_redirect_host: expectedHost,
      observed_redirect_host: redirectHost ?? null,
      desktop_order_id: desktopOrder ?? null,
      signed_webhook_lifecycle: "succeeded",
      recorded_at: new Date().toISOString(),
    }, null, 2)}\n`, { mode: 0o600 });
  });
});
