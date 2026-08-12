import { test, expect } from "@playwright/test";
import {
  authenticatePage,
  ensureQaUser,
  expectNoHorizontalOverflow,
  qaConfig,
  requiredEnv,
  serviceFetch,
} from "./helpers/staging.mjs";

let config;
let admin;
let rightsReviewer;
let viewer;
let finance;
let reportViewer;

async function expectAuthorized(page, route, pattern = null) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status() ?? 599).toBeLessThan(500);
  expect(["/login", "/"]).not.toContain(new URL(page.url()).pathname);
  if (pattern) await expect(page.locator("body")).toContainText(pattern);
}

test.describe.serial("Studio authorization and Premium reporting", () => {
  test.beforeAll(async () => {
    config = qaConfig();
    admin = await ensureQaUser(config, requiredEnv("STAGING_QA_ADMIN_EMAIL"), "admin");
    rightsReviewer = await ensureQaUser(config, requiredEnv("STAGING_QA_RESTRICTED_EMAIL"), "rights_reviewer");
    viewer = await ensureQaUser(config, requiredEnv("STAGING_QA_UNAUTHORIZED_EMAIL"), "viewer");

    const financeEmail = (process.env.STAGING_QA_FINANCE_EMAIL ?? process.env.FINANCE_EMAIL ?? "").trim();
    const reportViewerEmail = (process.env.STAGING_QA_REPORT_VIEWER_EMAIL ?? process.env.VIEWER_EMAIL ?? "").trim();
    if (!financeEmail || !reportViewerEmail) throw new Error("STAGING_QA_FINANCE_EMAIL/FINANCE_EMAIL and STAGING_QA_REPORT_VIEWER_EMAIL/VIEWER_EMAIL are required for Premium reporting tests.");
    finance = await ensureQaUser(config, financeEmail, "finance");
    reportViewer = await ensureQaUser(config, reportViewerEmail, "subscriber");
  });

  test("anonymous users cannot enter Studio or call finance APIs", async ({ page, request }) => {
    await page.goto("/studio", { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe("/login");

    expect((await request.get("/api/studio/premium-reports/payments")).status()).toBe(401);
    expect((await request.get("/api/studio/premium-reports/export/payments")).status()).toBe(401);
  });

  test("admin can access all core Studio operational surfaces", async ({ page }) => {
    await authenticatePage(page, config, admin.email, "/studio");
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

    const financeApi = await page.context().request.get("/api/studio/premium-reports/payments?preset=last30&pageSize=1");
    expect([401, 403]).not.toContain(financeApi.status());
    expect(financeApi.status()).toBeLessThan(500);
  });

  test("rights reviewer keeps Studio access but cannot cross finance capability boundary", async ({ page }) => {
    await authenticatePage(page, config, rightsReviewer.email, "/studio");
    await expectAuthorized(page, "/studio", /Studio/i);

    await page.goto("/studio/finance/reports", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/Permission denied/i);

    const response = await page.context().request.get("/api/studio/premium-reports/payments");
    expect(response.status()).toBe(403);
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

    await page.goto("/studio/finance/reports/payments?preset=custom&start=2026-07-01&end=2026-07-31&groupBy=daily&pageSize=1", { waitUntil: "networkidle" });
    const filteredBody = await page.locator("body").innerText();
    expect(filteredBody).toMatch(/Asia\/Karachi/i);
    expect(filteredBody).toMatch(/2026-07-01/);
    expect(filteredBody).toMatch(/2026-07-31/);
    expect(filteredBody).toMatch(/Page 1 of/i);
    expect(await page.locator('a:has-text("Next")').count()).toBeGreaterThan(0);

    await page.goto("/studio/finance/reports/payments?preset=last30&plan=staging-plan-that-does-not-exist", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/No payments match the selected filters/i);

    await page.goto("/studio/finance/reports/payments?preset=custom&start=2026-07-31&end=2026-07-01", { waitUntil: "networkidle" });
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

    const auditResponse = await serviceFetch(
      config,
      `/rest/v1/audit_logs?select=actor_id,action,entity_id,metadata,created_at&actor_id=eq.${encodeURIComponent(finance.id)}&action=eq.premium_report_exported&entity_id=eq.payments&order=created_at.desc&limit=1`,
    );
    expect(auditResponse.ok).toBeTruthy();
    const [audit] = await auditResponse.json();
    expect(audit?.actor_id).toBe(finance.id);
    expect(audit?.metadata?.content_sha256).toBe(exportHash);
    expect(typeof audit?.metadata?.row_count).toBe("number");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio/finance/reports/payments?preset=last30&pageSize=1", { waitUntil: "networkidle" });
    await expectNoHorizontalOverflow(page, "mobile finance report");
    await expect(page.locator("body")).toContainText(/Payment ledger/i);
  });

  test("non-finance report viewer receives denied UI and 403 report/export APIs", async ({ page }) => {
    await authenticatePage(page, config, reportViewer.email, "/studio/finance/reports");
    await page.goto("/studio/finance/reports", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/Permission denied/i);
    expect((await page.context().request.get("/api/studio/premium-reports/payments")).status()).toBe(403);
    expect((await page.context().request.get("/api/studio/premium-reports/export/payments")).status()).toBe(403);
  });
});
