import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.JALWA_BROWSER_BASE_URL ?? "http://127.0.0.1:3012";
const expectedVersion = process.env.JALWA_EXPECTED_VERSION;
assert.ok(expectedVersion, "JALWA_EXPECTED_VERSION is required");

async function openChecked(page, path) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 30_000 });
  assert.ok(response, `No response for ${path}`);
  assert.ok(response.status() < 500, `${path} returned ${response.status()}`);
  return response;
}

const browser = await chromium.launch({ headless: true });
const browserErrors = [];

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-PK" });
  const page = await desktop.newPage();
  page.on("pageerror", (error) => browserErrors.push(`desktop pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("api.example.com")) browserErrors.push(`desktop console: ${message.text()}`);
  });

  await openChecked(page, "/");
  assert.equal(await page.title(), "Jalwa");
  await page.getByRole("heading", { level: 1, name: /Pakistan ki kahaniyan/i }).waitFor();
  await page.getByRole("link", { name: /Explore content/i }).waitFor();
  await page.getByRole("link", { name: /Sign in/i }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.release), expectedVersion);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "Desktop layout overflows horizontally");

  await openChecked(page, "/login");
  await page.getByRole("heading", { level: 1, name: /Sign in your way/i }).waitFor();
  await page.getByLabel("Email").waitFor();
  await page.getByRole("button", { name: /Send sign-in link/i }).waitFor();
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY", "Keyboard focus did not enter the page");

  await openChecked(page, "/signup");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.locator("input[type=email]").first().waitFor();

  const health = await page.request.get(`${baseUrl}/api/health`);
  assert.equal(health.status(), 200);
  assert.equal((await health.json()).version, expectedVersion);
  const readiness = await page.request.get(`${baseUrl}/api/readiness`);
  assert.equal(readiness.status(), 503, "Readiness must fail closed without production services");
  const readinessBody = await readiness.json();
  assert.deepEqual(Object.keys(readinessBody).sort(), ["service", "status", "time", "version"], "Public readiness leaked internal diagnostics");

  const cspReport = await page.request.post(`${baseUrl}/api/security/csp-report`, {
    data: { "csp-report": { "effective-directive": "script-src", "blocked-uri": "https://blocked.example/path?secret=value" } },
    headers: { "content-type": "application/csp-report" },
  });
  assert.equal(cspReport.status(), 204);

  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ur-PK" });
  const mobilePage = await mobile.newPage();
  mobilePage.on("pageerror", (error) => browserErrors.push(`mobile pageerror: ${error.message}`));
  mobilePage.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("api.example.com")) browserErrors.push(`mobile console: ${message.text()}`);
  });
  await openChecked(mobilePage, "/");
  await mobilePage.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "Mobile layout overflows horizontally");
  await mobilePage.getByRole("link", { name: /Explore content/i }).click();
  await mobilePage.waitForURL(/\/explore/);
  assert.ok((await mobilePage.locator("main h1, main h2").count()) > 0, "Explore route lacks a primary heading");
  await mobile.close();

  assert.deepEqual(browserErrors, [], browserErrors.join("\n"));
  console.log("Production browser acceptance passed.");
} finally {
  await browser.close();
}
