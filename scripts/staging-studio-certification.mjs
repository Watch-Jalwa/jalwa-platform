#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { authenticatePage, ensureQaUser, qaConfig } from "./lib/staging-qa-auth.mjs";

const evidenceDir = process.env.CERTIFICATION_EVIDENCE_DIR || "/tmp/jalwa-staging-certification";
const adminEmail = (process.env.STAGING_QA_ADMIN_EMAIL ?? "").trim();
const restrictedEmail = (process.env.STAGING_QA_RESTRICTED_EMAIL ?? "").trim();
const unauthorizedEmail = (process.env.STAGING_QA_UNAUTHORIZED_EMAIL ?? "").trim();

function blocked(message) {
  console.error(message);
  process.exitCode = 2;
}

async function expectAuthorized(page, url, bodyPattern) {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response || response.status() >= 500) throw new Error(`${new URL(url).pathname} did not render safely.`);
  const pathname = new URL(page.url()).pathname;
  if (pathname === "/login" || pathname === "/") throw new Error(`${new URL(url).pathname} was not authorized for the expected Studio identity.`);
  const body = await page.locator("body").innerText();
  if (bodyPattern && !bodyPattern.test(body)) throw new Error(`${new URL(url).pathname} did not show the expected Studio content.`);
}

async function main() {
  if (!adminEmail || !restrictedEmail || !unauthorizedEmail) {
    return blocked("BLOCKED: STAGING_QA_ADMIN_EMAIL, STAGING_QA_RESTRICTED_EMAIL and STAGING_QA_UNAUTHORIZED_EMAIL must be configured as protected staging values.");
  }

  let config;
  try { config = qaConfig(); }
  catch (error) { return blocked(`BLOCKED: ${error.message}`); }

  await mkdir(evidenceDir, { recursive: true });
  const admin = await ensureQaUser(config, adminEmail, "admin");
  const restricted = await ensureQaUser(config, restrictedEmail, "rights_reviewer");
  const unauthorized = await ensureQaUser(config, unauthorizedEmail, "viewer");

  const browser = await chromium.launch({ headless: true });
  const evidence = {
    schema_version: 1,
    identities: {
      admin: { id: admin.id, role: "admin" },
      restricted: { id: restricted.id, role: "rights_reviewer" },
      unauthorized: { id: unauthorized.id, role: "viewer" },
    },
    checks: [],
    recorded_at: new Date().toISOString(),
  };

  try {
    const anonymous = await browser.newContext({ baseURL: config.baseUrl });
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(`${config.baseUrl}/studio`, { waitUntil: "networkidle" });
    if (new URL(anonymousPage.url()).pathname !== "/login") throw new Error("Anonymous Studio access was not redirected to login.");
    const anonymousApi = await anonymous.request.get(`${config.baseUrl}/api/studio/premium-reports/payments`);
    if (anonymousApi.status() !== 401) throw new Error(`Anonymous Studio finance API returned HTTP ${anonymousApi.status()} instead of 401.`);
    evidence.checks.push("anonymous Studio page and finance API are denied");
    await anonymous.close();

    const adminContext = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1440, height: 1000 } });
    const adminPage = await adminContext.newPage();
    await authenticatePage(adminPage, config, admin.email, "/studio");
    const adminSurfaces = [
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
    for (const [route, pattern] of adminSurfaces) {
      await expectAuthorized(adminPage, `${config.baseUrl}${route}`, pattern);
    }
    const adminFinanceApi = await adminContext.request.get(`${config.baseUrl}/api/studio/premium-reports/payments?preset=last30&pageSize=1`);
    if ([401, 403].includes(adminFinanceApi.status()) || adminFinanceApi.status() >= 500) {
      throw new Error(`Admin Studio finance API authorization failed with HTTP ${adminFinanceApi.status()}.`);
    }
    await adminPage.goto(`${config.baseUrl}/studio`, { waitUntil: "networkidle" });
    await adminPage.screenshot({ path: path.join(evidenceDir, "studio-admin.png"), fullPage: true });
    evidence.checks.push("admin can enter core content, moderation, support, finance, operations, live, DRM and alpha surfaces");
    evidence.checks.push("admin can use the authorized finance reporting API boundary");
    await adminContext.close();

    const restrictedContext = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1280, height: 900 } });
    const restrictedPage = await restrictedContext.newPage();
    await authenticatePage(restrictedPage, config, restricted.email, "/studio");
    await expectAuthorized(restrictedPage, `${config.baseUrl}/studio`, /Studio/i);
    await restrictedPage.goto(`${config.baseUrl}/studio/finance/reports`, { waitUntil: "networkidle" });
    const restrictedBody = await restrictedPage.locator("body").innerText();
    if (!/Permission denied/i.test(restrictedBody)) throw new Error("Rights reviewer did not receive the expected finance permission denial.");
    const restrictedApi = await restrictedContext.request.get(`${config.baseUrl}/api/studio/premium-reports/payments`);
    if (restrictedApi.status() !== 403) throw new Error(`Rights reviewer finance API returned HTTP ${restrictedApi.status()} instead of 403.`);
    evidence.checks.push("rights reviewer remains Studio staff but cannot bypass finance capability through UI or API");
    await restrictedContext.close();

    const viewerContext = await browser.newContext({ baseURL: config.baseUrl });
    const viewerPage = await viewerContext.newPage();
    await authenticatePage(viewerPage, config, unauthorized.email, "/studio");
    await viewerPage.goto(`${config.baseUrl}/studio`, { waitUntil: "networkidle" });
    if (new URL(viewerPage.url()).pathname !== "/") throw new Error("Viewer role reached a protected Studio route.");
    const viewerApi = await viewerContext.request.get(`${config.baseUrl}/api/studio/premium-reports/payments`);
    if (viewerApi.status() !== 403) throw new Error(`Viewer finance API returned HTTP ${viewerApi.status()} instead of 403.`);
    evidence.checks.push("viewer cannot enter Studio or bypass the finance API");
    await viewerContext.close();

    await writeFile(path.join(evidenceDir, "studio-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log(`Studio authorization certification passed (${evidence.checks.length} checks).`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Studio staging certification failed: ${error.message}`);
  process.exitCode = 1;
});
