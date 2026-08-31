import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");
if (!baseURL) throw new Error("STAGING_BASE_URL or JALWA_BROWSER_BASE_URL is required for staging Playwright tests.");

export default defineConfig({
  testDir: "./qa/playwright",
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || "test-results/staging-playwright",
  reporter: [
    ["list"],
    ["html", { outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || "playwright-report/staging", open: "never" }],
    ["junit", { outputFile: process.env.PLAYWRIGHT_JUNIT_REPORT || "test-results/staging-playwright/junit.xml" }],
  ],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    locale: "en-PK",
    timezoneId: "Asia/Karachi",
    reducedMotion: "reduce",
    headless: true,
    ignoreHTTPSErrors: false,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 40_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
