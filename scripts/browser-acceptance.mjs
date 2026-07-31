import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.JALWA_BROWSER_BASE_URL;
if (!baseUrl) throw new Error("JALWA_BROWSER_BASE_URL is required");

const browser = await chromium.launch({ headless: true });
const failures = [];

function trackRuntimeFailures(page, label) {
  page.on("pageerror", (error) => failures.push(`${label} page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && new URL(response.url()).origin === new URL(baseUrl).origin) {
      failures.push(`${label} ${response.status()} response: ${response.url()}`);
    }
  });
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
  await page.getByRole("heading", { level: 1, name: /Pakistan ki kahaniyan/i }).waitFor();
  assert.match(await page.title(), /Jalwa/i);
  await page.getByRole("link", { name: "Explore content" }).click();
  await page.getByRole("heading", { level: 1, name: "Explore Jalwa" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/explore");

  const search = page.getByRole("textbox", { name: "Search Jalwa" });
  await search.fill("skills");
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/\/explore\?q=skills/);
  await page.getByText(/result.*for “skills”/i).waitFor();

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Sign in your way." }).waitFor();
  const loginEmail = page.getByRole("textbox", { name: "Email" });
  assert.equal(await loginEmail.getAttribute("type"), "email");
  assert.equal(await loginEmail.getAttribute("required"), "");
  assert.equal(await page.getByRole("button", { name: "Send sign-in link" }).isEnabled(), true);
  assert.equal(await loginEmail.evaluate((element) => element.checkValidity()), false);

  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: /One account for watching/i }).waitFor();
  await page.getByRole("textbox", { name: "Your name" }).fill("Launch Test");
  await page.getByRole("textbox", { name: "Email" }).fill("launch@example.com");
  await page.getByRole("combobox", { name: "Preferred language" }).selectOption("ur");
  await page.getByRole("radio", { name: /Free/ }).check();
  const terms = page.getByRole("checkbox", { name: /I accept the Terms/i });
  assert.equal(await terms.isChecked(), false);
  assert.equal(await terms.evaluate((element) => element.checkValidity()), false);
  await terms.check();
  assert.equal(await terms.evaluate((element) => element.checkValidity()), true);

  await page.goto("/legal/privacy", { waitUntil: "networkidle" });
  assert.equal((await page.locator("h1").count()) >= 1, true);
  await page.goto("/legal/terms", { waitUntil: "networkidle" });
  assert.equal((await page.locator("h1").count()) >= 1, true);

  const health = await page.request.get("/api/health");
  assert.equal(health.ok(), true);
  const healthJson = await health.json();
  assert.equal(healthJson.status, "ready");
  assert.match(String(healthJson.version), /^[0-9a-f]{40}$/);

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
  const mobileNavigation = mobilePage.getByRole("navigation", { name: "Mobile navigation" });
  await mobileNavigation.waitFor();
  assert.equal(await mobileNavigation.getByRole("link", { name: /Home/ }).isVisible(), true);
  assert.equal(await mobileNavigation.getByRole("link", { name: /Profile/ }).isVisible(), true);
  await mobileNavigation.getByRole("link", { name: /Profile/ }).focus();
  assert.equal(await mobileNavigation.getByRole("link", { name: /Profile/ }).evaluate((element) => element === document.activeElement), true);
  await mobile.close();

  assert.deepEqual(failures, []);
  console.log("Browser acceptance journeys passed.");
} finally {
  await browser.close();
}
