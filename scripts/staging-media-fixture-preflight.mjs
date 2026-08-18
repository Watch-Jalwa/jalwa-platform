#!/usr/bin/env node
import { chromium } from "@playwright/test";

const baseUrl = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");

function blocked(message) {
  console.error(`BLOCKED: ${message}`);
  process.exitCode = 2;
}

async function main() {
  if (!/^https:\/\//.test(baseUrl)) return blocked("STAGING_BASE_URL must be a protected HTTPS staging URL.");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    const response = await page.goto("/explore", { waitUntil: "networkidle" });
    if (!response || response.status() >= 500) throw new Error(`Catalogue explore page returned HTTP ${response?.status() ?? "none"}.`);
    const watchLinks = await page.locator('a[href^="/watch/"]').count();
    if (watchLinks === 0) return blocked("No rights-approved published staging item is available for representative media certification.");
    console.log(`Media fixture preflight found ${watchLinks} published watch link(s).`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Media fixture preflight failed: ${error.message}`);
  process.exitCode = 1;
});
