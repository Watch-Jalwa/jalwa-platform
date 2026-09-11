import { test, expect } from "@playwright/test";
import {
  authenticatePage,
  ensureQaUser,
  expectNoHorizontalOverflow,
  qaConfig,
  qaFetch,
} from "./helpers/staging.mjs";

const config = qaConfig();
const adminEmail = (process.env.STAGING_QA_ADMIN_EMAIL ?? "").trim();
const rightsEmail = (process.env.STAGING_QA_RESTRICTED_EMAIL ?? "").trim();
const viewerEmail = (process.env.STAGING_QA_UNAUTHORIZED_EMAIL ?? "").trim();
const financeEmail = (process.env.STAGING_QA_FINANCE_EMAIL ?? "").trim();
const reportViewerEmail = (process.env.STAGING_QA_REPORT_VIEWER_EMAIL ?? "").trim();
const reportProbe = "/api/studio/premium-reports/payments?preset=last30&pageSize=1";

let admin;
let rightsReviewer;
let viewer;
let finance;
let reportViewer;

function karachiDate(daysAgo = 0) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function authenticateVerified(page, email, expectedReportStatus) {
  const failures = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.context().clearCookies();
    try {
      await authenticatePage(page, config, email, "/profile");
      const profile = await page.goto("/profile", { waitUntil: "networkidle" });
      const pathname = new URL(page.url()).pathname;
      if ((profile?.status() ?? 599) >= 500 || pathname !== "/profile") {
        failures.push(`attempt ${attempt}: profile ended at ${pathname}`);
        continue;
      }
      const report = await page.context().request.get(reportProbe);
      if (report.status() !== expectedReportStatus) {
        failures.push(`attempt ${attempt}: report probe returned ${report.status()}, expected ${expectedReportStatus}`);
        continue;
      }
      return;
    } catch (error) {
      failures.push(`attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Could not establish the expected Studio QA session for ${email}: ${failures.join("; ")}`);
}

async function expectAuthorized(page, route, pattern = null) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  expect(response?.status() ?? 599, `${route} returned a server error.`).toBeLessThan(500);
  const pathname = new URL(page.url()).pathname;
  expect(["/login", "/"], `${route} unexpectedly redirected to ${pathname}.`).not.toContain(pathname);
  if (pattern) await expect(page.locator("body")).toContainText(pattern);
}

test.describe("Studio authorization and Premium reporting", () => {
  test.beforeAll(async () => {
    for (const [name, value] of Object.entries({ adminEmail, rightsEmail, viewerEmail, financeEmail, reportViewerEmail })) {
      if (!value) throw new Error(`${name} is required for Studio certification.`);
    }
    admin = await ensureQaUser(config, adminEmail, "admin");
    rightsReviewer = await ensureQaUser(config, rightsEmail, "rights_reviewer");
    viewer = await ensureQaUser(config, viewerEmail, "viewer");
    finance = await ensureQaUser(config, financeEmail, "finance");
    reportViewer = await ensureQaUser(config, reportViewerEmail, "subscriber");
  });

  test("anonymous users cannot enter Studio or call finance APIs", async ({ page }) => {
    await page.goto("/studio", { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe("/login");
    expect((await page.context().request.get("/api/studio/premium-reports/payments")).status()).toBe(401);
    expect((await page.context().request.get("/api/studio/premium-reports/export/payments")).status()).toBe(401);
  });

  test("admin can access all core Studio operational surfaces", async ({ page }) => {
    await authenticateVerified(page, admin.email, 200);
    const surfaces = [
      ["/studio", /Studio/i],
      ["/studio/content", /content/i],
      ["/studio/moderation", null],
      ["/studio/support", null],
      ["/studio/finance", /finance|premium/i],
      ["/studio/operations", null],
      ["/studio/live", null],
      ["/studio/drm", null],
      ["/studio/alpha", null],
    ];
    for (const [route, pattern] of surfaces) await expectAuthorized(page, route, pattern);

    const financeApi = await page.context().request.get(reportProbe);
    expect(financeApi.status()).toBe(200);
  });

  test("rights reviewer keeps Studio access but cannot cross finance capability boundary", async ({ page }) => {
    test.setTimeout(120_000);
    await authenticateVerified(page, rightsReviewer.email, 403);
    await expectAuthorized(page, "/studio", /Studio/i);

    await page.goto("/studio/finance/reports", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/Permission denied/i);
    expect((await page.context().request.get("/api/studio/premium-reports/payments")).status()).toBe(403);
    expect((await page.context().request.get("/api/studio/premium-reports/export/payments")).status()).toBe(403);
  });

  test("viewer cannot enter Studio or bypass Studio APIs", async ({ page }) => {
    await authenticatePage(page, config, viewer.email, "/studio");
    await page.goto("/studio", { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe("/");
    const response = await page.context().request.get("/api/studio/premium-reports/payments");
    expect(response.status()).toBe(403);
  });

  test("finance role can use every Premium report, filters, pagination, empty states and CSV export", async ({ page }) => {
    await authenticatePage(page, config, finance.email, "/studio/finance/reports");
    await page.goto("/studio/finance/reports", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/Premium reports/i);

    const sections = [
      ["/studio/finance/reports/payments?preset=last30&pageSize=1", /Payment ledger/i],
      ["/studio/finance/reports/subscriptions?preset=last30&pageSize=1", /Subscription ledger/i],
      ["/studio/finance/reports/recurring?preset=last30&pageSize=1", /Recurring customers/i],
      ["/studio/finance/reports/reconciliation?preset=last30&pageSize=1", /Reconciliation attention/i],
      ["/studio/finance/reports/benefits?preset=last30", /Benefit costs/i],
    ];
    for (const [route, pattern] of sections) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status() ?? 599).toBeLessThan(400);
      await expect(page.locator("body")).toContainText(pattern);
    }

    const customStart = karachiDate(10);
    const customEnd = karachiDate(0);
    await page.goto(`/studio/finance/reports/payments?preset=custom&start=${customStart}&end=${customEnd}&groupBy=daily&pageSize=1`, { waitUntil: "networkidle" });
    const filteredBody = await page.locator("body").innerText();
    expect(filteredBody).toMatch(/Asia\/Karachi/i);
    expect(filteredBody).toContain(customStart);
    expect(filteredBody).toContain(customEnd);
    expect(filteredBody).toMatch(/Page 1 of/i);
    expect(await page.locator('a:has-text("Next")').count()).toBeGreaterThan(0);

    await page.goto("/studio/finance/reports/payments?preset=last30&plan=staging-plan-that-does-not-exist", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/No payments match the selected filters/i);

    await page.goto(`/studio/finance/reports/payments?preset=custom&start=${customEnd}&end=${customStart}`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/Invalid report range|must not be after|report unavailable/i);

    const exportResponse = await page.context().request.get("/api/studio/premium-reports/export/payments?preset=last30");
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["content-type"] ?? "").toMatch(/^text\/csv/i);
    expect(exportResponse.headers()["content-disposition"] ?? "").toMatch(/attachment; filename=/i);
    expect(exportResponse.headers()["cache-control"] ?? "").toMatch(/private/);
    expect(exportResponse.headers()["cache-control"] ?? "").toMatch(/no-store/);
    const exportHash = exportResponse.headers()["x-jalwa-report-sha256"];
    expect(exportHash ?? "").toMatch(/^[0-9a-f]{64}$/);
    const csv = await exportResponse.text();
    expect(csv).toMatch(/Payment ID/);
    expect(csv).not.toMatch(/service_role|JWT_SECRET|PAYMENT_WEBHOOK_SECRET|raw_event|payload_hash/i);

    const auditResponse = await qaFetch(config, "audit-export", { actorId: finance.id, entityId: "payments" });
    expect(auditResponse.ok).toBeTruthy();
    const { data: audit } = await auditResponse.json();
    expect(audit?.actor_id).toBe(finance.id);
    expect(audit?.metadata?.content_sha256).toBe(exportHash);
    expect(typeof audit?.metadata?.row_count).toBe("number");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/finance/reports/payments?preset=last30&pageSize=1", { waitUntil: "networkidle" });
    await expectNoHorizontalOverflow(page, "mobile finance report");
    await expect(page.locator("body")).toContainText(/Payment ledger/i);
  });

  test("non-finance report viewer is authenticated but receives hard denial and 403 report/export APIs", async ({ page }) => {
    await authenticateVerified(page, reportViewer.email, 403);

    await page.goto("/studio/finance/reports", { waitUntil: "networkidle" });
    const denialUrl = new URL(page.url());
    expect(denialUrl.pathname).toBe("/permission-denied");
    expect(denialUrl.searchParams.get("scope")).toBe("studio");
    expect((await page.context().request.get("/api/studio/premium-reports/payments")).status()).toBe(403);
    expect((await page.context().request.get("/api/studio/premium-reports/export/payments")).status()).toBe(403);
  });
});
