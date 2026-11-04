import { test, expect, devices } from "@playwright/test";
import { expectNoHorizontalOverflow, expectedReleaseSha, watchRuntimeFailures } from "./helpers/staging.mjs";

const baseURL = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");

test.describe("public customer web", () => {
  test("home, release identity and staging indexing boundary", async ({ page }) => {
    const failures = watchRuntimeFailures(page, "home");
    const response = await page.goto("/", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1.visually-hidden")).toHaveCount(1);
    await expect(page).toHaveTitle(/Jalwa/i);
    await expect(page.getByRole("link", { name: /Watch Now/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Subscribe Now/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, "desktop home");

    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "").toMatch(/noindex/i);

    const health = await page.request.get("/api/health");
    expect(health.status()).toBe(200);
    const payload = await health.json();
    expect(payload.status).toBe("ready");
    expect(payload.service).toBe("jalwa-web");
    expect(payload.version).toBe(expectedReleaseSha());
    expect(failures).toEqual([]);
  });

  test("explore navigation and search", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Watch Now/i }).click();
    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole("heading", { level: 1, name: /Explore Jalwa/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, "desktop explore");

    const search = page.getByRole("textbox", { name: /Search Jalwa/i });
    await search.fill("skills");
    await page.getByRole("button", { name: /Search/i }).click();
    await expect(page).toHaveURL(/\/explore\?q=skills/);
  });

  test("login and signup validation remain accessible", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Sign in or create account/i })).toBeVisible();
    await expect(page.getByLabel(/Full name/i)).toBeVisible();
    const identity = page.getByLabel(/Email or mobile number/i);
    await expect(identity).toBeVisible();
    expect(await identity.evaluate((element) => element.checkValidity())).toBe(false);
    await expect(page.getByRole("button", { name: /^Continue$/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, "desktop login");

    await page.goto("/signup", { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe("/login");
    await page.getByLabel(/Full name/i).fill("Staging Playwright");
    await page.getByLabel(/Email or mobile number/i).fill("playwright@example.com");
    await expect(page.getByRole("button", { name: /^Continue$/i })).toBeEnabled();
  });

  test("legal pages, manifest, readiness and CSP reporting are healthy", async ({ page }) => {
    for (const route of ["/legal/privacy", "/legal/terms"]) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
    }

    const readiness = await page.request.get("/api/readiness");
    expect(readiness.status()).toBe(200);
    const readinessPayload = await readiness.json();
    expect(readinessPayload.status).toBe("ready");
    expect(readinessPayload).not.toHaveProperty("missingConfiguration");
    expect(readinessPayload).not.toHaveProperty("migrationIssues");
    expect(readinessPayload).not.toHaveProperty("dependencies");

    const csp = await page.request.post("/api/security/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: { "csp-report": { "document-uri": `${baseURL}/`, "violated-directive": "script-src" } },
    });
    expect(csp.status()).toBe(204);

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBeTruthy();
    expect(manifest.headers()["content-type"] ?? "").toMatch(/json|manifest/i);
  });

  test("mobile navigation has no horizontal overflow and is keyboard focusable", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL,
      locale: "ur-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.getByRole("link", { name: /Explore content/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, "mobile home");
      const navigation = page.getByRole("navigation", { name: /Mobile navigation/i });
      await expect(navigation).toBeVisible();
      const profile = navigation.getByRole("link", { name: /Profile/i });
      await profile.focus();
      expect(await profile.evaluate((element) => element === document.activeElement)).toBe(true);

      await page.goto("/login", { waitUntil: "networkidle" });
      await expect(page.getByRole("textbox", { name: /Email/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, "mobile login");
    } finally {
      await context.close();
    }
  });
});
