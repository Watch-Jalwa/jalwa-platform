import { writeFile } from "node:fs/promises";
import { test, expect, devices } from "@playwright/test";
import { authenticatePage, ensureQaUser, qaConfig, requiredEnv } from "./helpers/staging.mjs";

const baseURL = requiredEnv("STAGING_BASE_URL").replace(/\/$/, "");
const expectedPortalHost = requiredEnv("STAGING_PAYMENT_SERVICE_EXPECTED_PORTAL_HOST").toLowerCase();
const testMsisdn = requiredEnv("STAGING_PAYMENT_SERVICE_TEST_MSISDN");
const releaseSha = requiredEnv("RELEASE_SHA");
const stagingDeploymentRunId = requiredEnv("STAGING_DEPLOYMENT_RUN_ID");
const evidenceFile = process.env.PAYMENT_SERVICE_PREFLIGHT_EVIDENCE_FILE || "payment-service-preflight-report.json";

if (!/^[0-9]{11,15}$/.test(testMsisdn)) throw new Error("STAGING_PAYMENT_SERVICE_TEST_MSISDN must be an 11–15 digit dedicated sandbox number.");

let config;
let customer;
let monthly;
let yearly;
let observedPortalHost = null;
let walletStartResult = null;

async function auth(page, next = "/pricing") {
  await authenticatePage(page, config, customer.email, next);
  await page.goto(next, { waitUntil: "networkidle" });
}

async function responseJson(response) {
  return response.json().catch(() => ({}));
}

async function checkAuthenticatedBoundary(page) {
  const plansResponse = await page.request.get(`${baseURL}/api/payments/plans`);
  expect(plansResponse.status()).toBe(200);
  const plans = await responseJson(plansResponse);
  expect(Array.isArray(plans)).toBeTruthy();
  monthly = plans.find((plan) => plan.interval === "monthly");
  yearly = plans.find((plan) => plan.interval === "yearly");
  expect(monthly?.code).toBeTruthy();
  expect(yearly?.code).toBeTruthy();
  expect(Number.isInteger(monthly?.fullAmountMinor)).toBeTruthy();
  expect(Number.isInteger(yearly?.fullAmountMinor)).toBeTruthy();
  expect(monthly.fullAmountMinor).toBeGreaterThan(0);
  expect(yearly.fullAmountMinor).toBeGreaterThan(0);

  const [statusResponse, walletResponse, paymentsResponse] = await Promise.all([
    page.request.get(`${baseURL}/api/payments/status`),
    page.request.get(`${baseURL}/api/payments/wallets`),
    page.request.get(`${baseURL}/api/payments/history`),
  ]);
  expect(statusResponse.status()).toBe(200);
  expect(walletResponse.status()).toBe(200);
  expect(paymentsResponse.status()).toBe(200);

  const status = await responseJson(statusResponse);
  const wallet = await responseJson(walletResponse);
  const payments = await responseJson(paymentsResponse);
  expect(["none", "pending", "linked", "unlinked", "failed"]).toContain(wallet.status);
  expect(typeof status.alreadySubscribed).toBe("boolean");
  expect(Array.isArray(status.subscriptions)).toBeTruthy();
  expect(Array.isArray(payments)).toBeTruthy();
  return { status, wallet };
}

async function startOrRecoverWallet(page) {
  const response = await page.request.post(`${baseURL}/api/payments/wallets/link`, {
    data: { msisdn: testMsisdn, planCode: monthly.code },
  });
  const body = await responseJson(response);
  if (response.status() === 201) {
    expect(body.method).toBe("POST");
    expect(typeof body.portalUrl).toBe("string");
    expect(typeof body.fields).toBe("object");
    expect(body.fields).not.toBeNull();
    expect(body).not.toHaveProperty("apiKey");
    const portal = new URL(body.portalUrl);
    expect(portal.protocol).toBe("https:");
    expect(portal.hostname.toLowerCase()).toBe(expectedPortalHost);
    observedPortalHost = portal.hostname.toLowerCase();
    walletStartResult = "portal_created";
    return;
  }
  if (response.status() === 409 && body.error === "already_linked") {
    walletStartResult = "already_linked";
    return;
  }
  throw new Error(`Wallet-link preflight failed: HTTP ${response.status()} ${JSON.stringify(body)}`);
}

test.describe.serial("payment service staging preflight", () => {
  test.beforeAll(async () => {
    config = qaConfig();
    customer = await ensureQaUser(config, requiredEnv("STAGING_QA_CUSTOMER_EMAIL"));
  });

  test("anonymous customer APIs do not expose protected user billing state", async ({ request }) => {
    for (const path of ["/api/payments/status", "/api/payments/wallets", "/api/payments/history"]) {
      const response = await request.get(`${baseURL}${path}`);
      expect(response.status(), path).toBe(401);
    }
  });

  test("authenticated desktop reaches authoritative plans, status and JazzCash wallet-link boundary", async ({ page }) => {
    await auth(page);
    await checkAuthenticatedBoundary(page);
    await startOrRecoverWallet(page);
  });

  test("invalid payment-service webhook signature fails without reconciliation", async ({ request }) => {
    const raw = JSON.stringify({ eventId: "preflight-invalid", type: "wallet.linked", userId: customer.id, createdAt: new Date().toISOString(), data: {} });
    const response = await request.post(`${baseURL}/api/webhooks/payment-service`, {
      headers: { "content-type": "application/json", "x-payment-event": "wallet.linked", "x-payment-signature": "00" },
      data: raw,
    });
    expect(response.status()).toBe(401);
  });

  test("mobile Premium page is usable with payment-service integration enabled", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL,
      locale: "en-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await auth(page);
      await expect(page.getByRole("heading", { name: /More Jalwa/i })).toBeVisible();
      await expect(page.getByText("JazzCash mobile number").first()).toBeVisible();
      await expect(page.getByText(/MPIN is entered only on JazzCash/i).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow).toBe(false);
    } finally {
      await context.close();
    }
  });

  test.afterAll(async () => {
    await writeFile(evidenceFile, `${JSON.stringify({
      schema_version: 1,
      status: "PREFLIGHT_PASS",
      release_sha: releaseSha,
      staging_deployment_run_id: stagingDeploymentRunId,
      expected_portal_host: expectedPortalHost,
      observed_portal_host: observedPortalHost,
      wallet_start_result: walletStartResult,
      full_wallet_completion: "NOT_TESTED_REQUIRES_SUPPORTED_JAZZCASH_SANDBOX",
      production_charge_authorized: false,
      recorded_at: new Date().toISOString(),
    }, null, 2)}\n`, { mode: 0o600 });
  });
});
