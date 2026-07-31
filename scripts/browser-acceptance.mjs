import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.JALWA_BROWSER_BASE_URL;
const expectedVersion = process.env.JALWA_EXPECTED_VERSION;
if (!baseUrl) throw new Error("JALWA_BROWSER_BASE_URL is required");
if (!expectedVersion || !/^[0-9a-f]{40}$/.test(expectedVersion)) {
  throw new Error("JALWA_EXPECTED_VERSION must be a lowercase 40-character Git SHA");
}

const applicationOrigin = new URL(baseUrl).origin;
const browser = await chromium.launch({ headless: true });
const failures = [];

function trackRuntimeFailures(page, label) {
  page.on("pageerror", (error) => failures.push(`${label} page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`${label} console error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500 && new URL(response.url()).origin === applicationOrigin) {
      failures.push(`${label} ${response.status()} response: ${response.url()}`);
    }
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label} has horizontal overflow: ${dimensions.scrollWidth} > ${dimensions.clientWidth}`,
  );
}

try {
  const desktop = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1366, height: 900 },
    locale: "en-PK",
    timezoneId: "Asia/Karachi",
    reducedMotion: "reduce",
  });
  const page = await desktop.newPage();
  trackRuntimeFailures(page, "desktop");

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.match(await page.title(), /Jalwa/i);
  await page.getByRole("link", { name: /Explore content/i }).waitFor();
  await assertNoHorizontalOverflow(page, "desktop home");

  await page.getByRole("link", { name: /Explore content/i }).click();
  await page.getByRole("heading", { level: 1, name: /Explore Jalwa/i }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/explore");
  await assertNoHorizontalOverflow(page, "desktop explore");

  const search = page.getByRole("textbox", { name: /Search Jalwa/i });
  await search.fill("skills");
  await page.getByRole("button", { name: /Search/i }).click();
  await page.waitForURL(/\/explore\?q=skills/);

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  const loginEmail = page.getByRole("textbox", { name: /Email/i });
  assert.equal(await loginEmail.getAttribute("type"), "email");
  assert.equal(await loginEmail.getAttribute("required"), "");
  assert.equal(await loginEmail.evaluate((element) => element.checkValidity()), false);
  await page.getByRole("button", { name: /Send sign-in link/i }).waitFor();
  await assertNoHorizontalOverflow(page, "desktop login");

  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("textbox", { name: /Your name/i }).fill("Launch Test");
  await page.getByRole("textbox", { name: /Email/i }).fill("launch@example.com");
  const terms = page.getByRole("checkbox", { name: /accept the Terms/i });
  assert.equal(await terms.isChecked(), false);
  assert.equal(await terms.evaluate((element) => element.checkValidity()), false);
  await terms.check();
  assert.equal(await terms.evaluate((element) => element.checkValidity()), true);

  for (const path of ["/legal/privacy", "/legal/terms"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    assert.ok((await page.locator("h1").count()) >= 1, `${path} must contain a primary heading`);
  }

  const health = await page.request.get("/api/health");
  assert.equal(health.status(), 200);
  const healthJson = await health.json();
  assert.equal(healthJson.status, "ready");
  assert.equal(healthJson.service, "jalwa-web");
  assert.equal(healthJson.version, expectedVersion);

  const readiness = await page.request.get("/api/readiness");
  assert.equal(readiness.status(), 503);
  const readinessJson = await readiness.json();
  assert.equal(readinessJson.status, "not_ready");
  assert.equal(Object.hasOwn(readinessJson, "missingConfiguration"), false);
  assert.equal(Object.hasOwn(readinessJson, "migrationIssues"), false);
  assert.equal(Object.hasOwn(readinessJson, "dependencies"), false);

  const cspReport = await page.request.post("/api/security/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: { "csp-report": { "document-uri": `${baseUrl}/`, "violated-directive": "script-src" } },
  });
  assert.equal(cspReport.status(), 204);

  const manifest = await page.request.get("/manifest.webmanifest");
  assert.equal(manifest.ok(), true);
  assert.match(manifest.headers()["content-type"] || "", /json|manifest/i);
  await desktop.close();

  const mobile = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ur-PK",
    timezoneId: "Asia/Karachi",
    reducedMotion: "reduce",
  });
  const mobilePage = await mobile.newPage();
  trackRuntimeFailures(mobilePage, "mobile");

  await mobilePage.goto("/", { waitUntil: "networkidle" });
  await mobilePage.getByRole("link", { name: /Explore content/i }).waitFor();
  await assertNoHorizontalOverflow(mobilePage, "mobile home");
  const mobileNavigation = mobilePage.getByRole("navigation", { name: /Mobile navigation/i });
  await mobileNavigation.waitFor();
  const profileLink = mobileNavigation.getByRole("link", { name: /Profile/i });
  await profileLink.focus();
  assert.equal(await profileLink.evaluate((element) => element === document.activeElement), true);

  await mobilePage.goto("/login", { waitUntil: "networkidle" });
  await mobilePage.getByRole("textbox", { name: /Email/i }).waitFor();
  await assertNoHorizontalOverflow(mobilePage, "mobile login");
  await mobile.close();

  assert.deepEqual(failures, []);
  console.log("Browser acceptance journeys passed.");
} finally {
  await browser.close();
}
