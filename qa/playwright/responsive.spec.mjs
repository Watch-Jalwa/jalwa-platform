import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers/staging.mjs";

const baseURL = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");
const liveExpected = (process.env.JALWA_EXPECT_LIVE_SOURCES ?? "false") === "true";
const routes = ["/", "/explore", "/pricing", "/login", "/signup"];
if (liveExpected) routes.push("/live");

for (const width of [360, 390]) {
  test(`public customer routes remain usable without horizontal overflow at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "en-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      for (const route of routes) {
        const response = await page.goto(route, { waitUntil: "networkidle" });
        expect(response?.status() ?? 599, `${route} failed at ${width}px`).toBeLessThan(500);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expectNoHorizontalOverflow(page, `${route} at ${width}px`);
      }
    } finally {
      await context.close();
    }
  });
}
