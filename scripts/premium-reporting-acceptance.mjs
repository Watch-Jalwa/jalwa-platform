import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { authenticatePage, ensureQaUser, qaConfig } from "./lib/staging-qa-auth.mjs";

const baseUrl = (process.env.JALWA_BROWSER_BASE_URL ?? process.env.STAGING_BASE_URL ?? "").replace(/\/$/, "");
const financeEmail = process.env.JALWA_FINANCE_EMAIL;
const viewerEmail = process.env.JALWA_VIEWER_EMAIL;
const expectedVersion = process.env.JALWA_EXPECTED_VERSION;
const reportFile = process.env.JALWA_PREMIUM_REPORT_FILE || "premium-reporting-acceptance.json";

for (const [name, value] of Object.entries({
  JALWA_BROWSER_BASE_URL: baseUrl,
  JALWA_FINANCE_EMAIL: financeEmail,
  JALWA_VIEWER_EMAIL: viewerEmail,
})) assert.ok(value, `${name} is required`);

const config = qaConfig();
assert.equal(config.baseUrl, baseUrl, "QA base URL must match the browser acceptance base URL");

async function bodyIncludes(page, pattern) {
  const body = await page.locator("body").innerText();
  assert.match(body, pattern);
  return body;
}

async function sharedRuntimeChecks(page) {
  const health = await page.request.get(`${baseUrl}/api/health`);
  assert.equal(health.status(), 200);
  const healthJson = await health.json();
  if (expectedVersion) assert.equal(healthJson.version, expectedVersion);
}

async function qaState(kind, params = {}) {
  const query = new URLSearchParams({ kind, ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) });
  const response = await fetch(`${baseUrl}/api/internal/qa/state?${query}`, { headers: { "x-jalwa-qa-token": config.qaSecret } });
  assert.equal(response.status(), 200, `QA state ${kind} failed with HTTP ${response.status}`);
  return response.json();
}

const browser = await chromium.launch({ headless: true });
const evidence = { generatedAt: new Date().toISOString(), baseUrl, expectedVersion: expectedVersion || null, checks: [] };

try {
  const financeUser = await ensureQaUser(config, financeEmail, "finance");
  await ensureQaUser(config, viewerEmail, "viewer");

  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(`${baseUrl}/api/studio/premium-reports/payments`)).status(), 401);
  assert.equal((await anonymous.request.get(`${baseUrl}/api/studio/premium-reports/export/payments`)).status(), 401);
  evidence.checks.push("anonymous report and export APIs return 401");
  await anonymous.close();

  const finance = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const financePage = await finance.newPage();
  await authenticatePage(financePage, config, financeEmail, "/studio/finance/reports");
  await financePage.goto(`${baseUrl}/studio/finance/reports`, { waitUntil: "networkidle" });
  await sharedRuntimeChecks(financePage);
  await bodyIncludes(financePage, /Premium reports/i);

  const sections = [
    ["/studio/finance/reports/payments?preset=last30&pageSize=1", /Payment ledger/i],
    ["/studio/finance/reports/subscriptions?preset=last30&pageSize=1", /Subscription ledger/i],
    ["/studio/finance/reports/recurring?preset=last30&pageSize=1", /Recurring customers/i],
    ["/studio/finance/reports/reconciliation?preset=last30&pageSize=1", /Reconciliation attention/i],
    ["/studio/finance/reports/benefits?preset=last30", /Benefit costs/i],
  ];
  for (const [path, heading] of sections) {
    const response = await financePage.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    assert.ok(response && response.status() < 400, `${path} failed`);
    await bodyIncludes(financePage, heading);
  }
  evidence.checks.push("all Premium report sections render for Finance");

  await financePage.goto(`${baseUrl}/studio/finance/reports/payments?preset=custom&start=2026-07-01&end=2026-07-31&groupBy=daily&pageSize=1`, { waitUntil: "networkidle" });
  const filteredBody = await bodyIncludes(financePage, /Asia\/Karachi/i);
  assert.match(filteredBody, /2026-07-01/);
  assert.match(filteredBody, /2026-07-31/);
  assert.match(filteredBody, /Page 1 of/i);
  assert.equal(await financePage.locator('a:has-text("Next")').count() > 0, true, "Seeded payment ledger should paginate at pageSize=1");
  evidence.checks.push("Karachi date filters and server pagination work");

  await financePage.goto(`${baseUrl}/studio/finance/reports/payments?preset=last30&plan=staging-plan-that-does-not-exist`, { waitUntil: "networkidle" });
  await bodyIncludes(financePage, /No payments match the selected filters/i);
  evidence.checks.push("empty-state rendering works");

  await financePage.goto(`${baseUrl}/studio/finance/reports/payments?preset=custom&start=2026-07-31&end=2026-07-01`, { waitUntil: "networkidle" });
  await bodyIncludes(financePage, /Invalid report range|must not be after|report unavailable/i);
  evidence.checks.push("invalid ranges fail in a controlled UI state");

  const exportResponse = await finance.request.get(`${baseUrl}/api/studio/premium-reports/export/payments?preset=last30`);
  assert.equal(exportResponse.status(), 200);
  assert.match(exportResponse.headers()["content-type"] || "", /^text\/csv/i);
  assert.match(exportResponse.headers()["content-disposition"] || "", /attachment; filename=/i);
  assert.match(exportResponse.headers()["cache-control"] || "", /private/);
  assert.match(exportResponse.headers()["cache-control"] || "", /no-store/);
  const exportHash = exportResponse.headers()["x-jalwa-report-sha256"];
  assert.match(exportHash || "", /^[0-9a-f]{64}$/);
  const csv = await exportResponse.text();
  assert.match(csv, /Payment ID/);
  assert.doesNotMatch(csv, /service_role|JWT_SECRET|PAYMENT_WEBHOOK_SECRET|raw_event|payload_hash/i);

  const { data: auditRow } = await qaState("audit-export", { actorId: financeUser.id, entityId: "payments" });
  assert.ok(auditRow, "Export audit row was not written");
  assert.equal(auditRow.metadata?.content_sha256, exportHash);
  assert.equal(typeof auditRow.metadata?.row_count, "number");
  evidence.checks.push("Finance CSV export is private, safe and audit-linked by SHA-256");

  await financePage.setViewportSize({ width: 390, height: 844 });
  await financePage.goto(`${baseUrl}/studio/finance/reports/payments?preset=last30&pageSize=1`, { waitUntil: "networkidle" });
  const overflow = await financePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Mobile report page overflows the viewport by ${overflow}px`);
  await bodyIncludes(financePage, /Payment ledger/i);
  evidence.checks.push("Finance report page remains usable at Pakistan-mobile viewport");
  await finance.close();

  const viewer = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const viewerPage = await viewer.newPage();
  await authenticatePage(viewerPage, config, viewerEmail, "/studio/finance/reports");
  await viewerPage.goto(`${baseUrl}/studio/finance/reports`, { waitUntil: "networkidle" });
  await bodyIncludes(viewerPage, /Permission denied/i);
  assert.equal((await viewer.request.get(`${baseUrl}/api/studio/premium-reports/payments`)).status(), 403);
  assert.equal((await viewer.request.get(`${baseUrl}/api/studio/premium-reports/export/payments`)).status(), 403);
  evidence.checks.push("non-Finance user receives denied UI and 403 APIs");
  await viewer.close();

  evidence.status = "passed";
  await writeFile(reportFile, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Premium reporting staging acceptance passed (${evidence.checks.length} checks).`);
} catch (error) {
  evidence.status = "failed";
  evidence.error = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportFile, `${JSON.stringify(evidence, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
