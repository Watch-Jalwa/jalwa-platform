#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.STAGING_BASE_URL ?? "").trim().replace(/\/$/, "");
const evidenceDir = process.env.CERTIFICATION_EVIDENCE_DIR || "/tmp/jalwa-staging-certification";

function blocked(message) {
  console.error(message);
  process.exitCode = 2;
}

async function main() {
  if (!/^https:\/\//.test(baseUrl)) return blocked("BLOCKED: STAGING_BASE_URL must be a protected HTTPS staging URL.");
  await mkdir(evidenceDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  const failedSameOriginRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    try {
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin) failedSameOriginRequests.push(`${request.method()} ${url.pathname}`);
    } catch {
      // Ignore malformed third-party URLs in browser diagnostics.
    }
  });

  try {
    const explore = await page.goto(`${baseUrl}/explore`, { waitUntil: "networkidle" });
    if (!explore || explore.status() >= 500) throw new Error(`Catalogue explore page returned HTTP ${explore?.status() ?? "none"}.`);
    const watchLinks = await page.locator('a[href^="/watch/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))]);
    if (watchLinks.length === 0) return blocked("BLOCKED: no published staging catalogue item is available for representative playback certification.");

    const watchPath = watchLinks[0];
    const response = await page.goto(`${baseUrl}${watchPath}`, { waitUntil: "networkidle" });
    if (!response || response.status() >= 500) throw new Error(`Representative watch page returned HTTP ${response?.status() ?? "none"}.`);
    const player = page.locator(".player-shell");
    if (!(await player.isVisible())) throw new Error("Representative watch page did not render a player surface.");

    const safeUnavailableBoundary = await player.locator(".player-placeholder").isVisible().catch(() => false);
    const providerHostedBoundary = await player.locator(".live-player-fallback").isVisible().catch(() => false);
    const mediaSurface = await player.locator("video, iframe, img").count();
    if (!safeUnavailableBoundary && !providerHostedBoundary && mediaSurface === 0) {
      throw new Error("Representative content exposed neither an in-player media surface, a provider-hosted live boundary nor the documented safe unavailable boundary.");
    }
    if (pageErrors.length) throw new Error(`Representative media page emitted browser errors: ${pageErrors.slice(0, 3).join("; ")}`);
    if (failedSameOriginRequests.length) throw new Error(`Representative media page had failed same-origin requests: ${failedSameOriginRequests.slice(0, 5).join("; ")}`);

    await page.screenshot({ path: path.join(evidenceDir, "media-catalogue.png"), fullPage: true });
    const playerBoundary = safeUnavailableBoundary
      ? "safe-unavailable"
      : providerHostedBoundary
        ? "provider-hosted-live"
        : "media-surface-present";
    const evidence = {
      schema_version: 1,
      representative_watch_path: watchPath,
      player_boundary: playerBoundary,
      same_origin_failed_requests: failedSameOriginRequests.length,
      page_errors: pageErrors.length,
      recorded_at: new Date().toISOString(),
    };
    await writeFile(path.join(evidenceDir, "media-catalogue-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log(`Catalogue/media certification passed for ${watchPath} with ${playerBoundary}.`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Catalogue/media staging certification failed: ${error.message}`);
  process.exitCode = 1;
});
