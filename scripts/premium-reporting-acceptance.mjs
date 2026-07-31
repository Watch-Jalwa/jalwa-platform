import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const baseUrl = process.env.JALWA_BROWSER_BASE_URL?.replace(/\/$/, "");
const supabaseUrl = process.env.JALWA_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.JALWA_SUPABASE_SERVICE_ROLE_KEY;
const financeEmail = process.env.JALWA_FINANCE_EMAIL;
const viewerEmail = process.env.JALWA_VIEWER_EMAIL;
const expectedVersion = process.env.JALWA_EXPECTED_VERSION;
const reportFile = process.env.JALWA_PREMIUM_REPORT_FILE || "premium-reporting-acceptance.json";

for (const [name, value] of Object.entries({
  JALWA_BROWSER_BASE_URL: baseUrl,
  JALWA_SUPABASE_URL: supabaseUrl,
  JALWA_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  JALWA_FINANCE_EMAIL: financeEmail,
  JALWA_VIEWER_EMAIL: viewerEmail,
})) {
  assert.ok(value, `${name} is required`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function actionLink(data) {
  return data?.properties?.action_link || data?.properties?.actionLink || data?.action_link || data?.actionLink;
}

async function magicLink(email, nextPath) {
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  assert.ifError(error);
  const link = actionLink(data);
  assert.ok(link, `No action link returned for ${email}`);
  return link;
}

async function signIn(context, email, nextPath) {
  const page = await context.newPage();
  const link = await magicLink(email, nextPath);
  const response = await page.goto(link, { waitUntil: "networkidle", timeout: 45_000 });
  assert.ok(response, `No authentication response for ${email}`);
  assert.ok(response.status() < 400, `Authentication failed for ${email}: ${response.status()}`);
  if (!new URL(page.url()).pathname.startsWith(nextPath)) {
    await page.goto(`${baseUrl}${nextPath}`, { waitUntil: "networkidle" });
  }
  return page;
}

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

const browser = await chromium.launch({ headless: true });
const evidence = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  expectedVersion: expectedVersion || null,
  checks: [],
};

try {
  const anonymous = await browser.newContext();
  const anonymousReport = await anonymous.request.get(`${baseUrl}/api/studio/premium-reports/payments`);
  assert.equal(anonymousReport.status(), 401);
  const anonymousExport = await anonymous.request.get(`${baseUrl}/api/studio/premium-reports/export/payments`);
  assert.equal(anonymousExport.status(), 401);
  evidence.checks.push("anonymous report and export APIs return 401");
  await anonymous.close();

  const finance = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const financePage = await signIn(finance, financeEmail, "/studio/finance/reports");
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

  const { data: financeUsers, error: financeUserError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ifError(financeUserError);
  const financeUser = financeUsers.users.find((user) => user.email === financeEmail);
  assert.ok(financeUser, "Finance acceptance user not found");
  const { data: auditRows, error: auditError } = await admin
    .from("audit_logs")
    .select("actor_id,action,entity_id,metadata,created_at")
    .eq("actor_id", financeUser.id)
    .eq("action", "premium_report_exported")
    .eq("entity_id", "payments")
    .order("created_at", { ascending: false })
    .limit(1);
  assert.ifError(auditError);
  assert.equal(auditRows?.length, 1, "Export audit row was not written");
  assert.equal(auditRows[0].metadata?.content_sha256, exportHash);
  assert.equal(typeof auditRows[0].metadata?.row_count, "number");
  evidence.checks.push("Finance CSV export is private, safe and audit-linked by SHA-256");

  await financePage.setViewportSize({ width: 390, height: 844 });
  await financePage.goto(`${baseUrl}/studio/finance/reports/payments?preset=last30&pageSize=1`, { waitUntil: "networkidle" });
  const overflow = await financePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Mobile report page overflows the viewport by ${overflow}px`);
  await bodyIncludes(financePage, /Payment ledger/i);
  evidence.checks.push("Finance report page remains usable at Pakistan-mobile viewport");
  await finance.close();

  const viewer = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const viewerPage = await signIn(viewer, viewerEmail, "/studio/finance/reports");
  await bodyIncludes(viewerPage, /Permission denied/i);
  const viewerReport = await viewer.request.get(`${baseUrl}/api/studio/premium-reports/payments`);
  assert.equal(viewerReport.status(), 403);
  const viewerExport = await viewer.request.get(`${baseUrl}/api/studio/premium-reports/export/payments`);
  assert.equal(viewerExport.status(), 403);
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
