#!/usr/bin/env node
import { chromium } from "@playwright/test";

const baseUrl = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");
const representativeSlug = (process.env.REPRESENTATIVE_MEDIA_SLUG ?? process.env.MEDIA_SLUG ?? "nasa-space-station-views").trim();

function blocked(message) {
  console.error(`BLOCKED: ${message}`);
  process.exitCode = 2;
}

async function inspectWatchPage(page, slug) {
  const response = await page.goto(`/watch/${encodeURIComponent(slug)}`, { waitUntil: "networkidle" });
  if (!response || response.status() >= 500) throw new Error(`Representative watch page returned HTTP ${response?.status() ?? "none"}.`);
  if (response.status() >= 400) return false;

  const playerShell = await page.locator(".player-shell").isVisible().catch(() => false);
  if (!playerShell) return false;

  const genericSafeBoundary = await page.locator(".player-placeholder").isVisible().catch(() => false);
  const liveSafeBoundary = await page.locator(".live-player-fallback").isVisible().catch(() => false);
  const mediaSurfaceCount = await page.locator("video, iframe, img").count();
  return genericSafeBoundary || liveSafeBoundary || mediaSurfaceCount > 0;
}

async function main() {
  if (!/^https:\/\//.test(baseUrl)) return blocked("STAGING_BASE_URL must be a protected HTTPS staging URL.");
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(representativeSlug)) return blocked("A valid representative staging media slug is required.");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    if (await inspectWatchPage(page, representativeSlug)) {
      console.log(`Media fixture preflight verified representative watch item: ${representativeSlug}`);
      return;
    }

    const explore = await page.goto("/explore", { waitUntil: "networkidle" });
    if (!explore || explore.status() >= 500) throw new Error(`Catalogue explore page returned HTTP ${explore?.status() ?? "none"}.`);
    const watchLinks = await page.locator('a[href^="/watch/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))]);
    for (const href of watchLinks) {
      const slug = href?.match(/^\/watch\/([a-z0-9][a-z0-9-]*)$/i)?.[1];
      if (slug && await inspectWatchPage(page, slug)) {
        console.log(`Media fixture preflight verified catalogue watch item: ${slug}`);
        return;
      }
    }

    return blocked("No rights-approved published staging item exposes a representative media boundary.");
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Media fixture preflight failed: ${error.message}`);
  process.exitCode = 1;
});
