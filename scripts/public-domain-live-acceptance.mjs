import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.JALWA_BROWSER_BASE_URL;
const expectedVersion = process.env.JALWA_EXPECTED_VERSION;
const reportFile = process.env.JALWA_PUBLIC_DOMAIN_LIVE_REPORT_FILE ?? "public-domain-live-acceptance.json";
if (!baseUrl) throw new Error("JALWA_BROWSER_BASE_URL is required");
if (!expectedVersion || !/^[0-9a-f]{40}$/.test(expectedVersion)) throw new Error("JALWA_EXPECTED_VERSION must be a 40-character Git SHA");

const expectedTitles = [
  "NASA Space Station Views",
  "NOAA Ocean Exploration Camera 1",
  "NOAA Ocean Exploration Camera 2",
  "NOAA Ocean Exploration Camera 3",
  "USGS Kīlauea V1",
  "USGS Kīlauea V2",
  "USGS Kīlauea V3",
  "USGS Mauna Loa Webcams",
  "USGS Rivers and Lakes",
];

const browser = await chromium.launch({ headless: true });
const report = { release: expectedVersion, baseUrl, checkedAt: new Date().toISOString(), checks: [] };
function passed(name, detail = null) { report.checks.push({ name, status: "passed", detail }); }

try {
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-PK",
    timezoneId: "Asia/Karachi",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const response = await page.goto("/live", { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { level: 1, name: /Official live public sources/i }).waitFor();
  const body = await page.locator("body").innerText();
  for (const title of expectedTitles) assert.match(body, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${title} missing from /live`);
  assert.doesNotMatch(body, /Premium/i, "Approved public live sources must not be Premium-gated");
  assert.match(body, /does not sponsor or endorse Jalwa/i);
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `Mobile /live overflow: ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
  passed("mobile-live-discovery", { titles: expectedTitles.length, width: dimensions.clientWidth });

  const watchLinks = await page.locator('a[href^="/watch/"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("href")).filter(Boolean))]);
  assert.ok(watchLinks.length >= 7, `Expected at least seven active live watch links, found ${watchLinks.length}`);
  passed("active-watch-links", { count: watchLinks.length });

  const health = await page.request.get("/api/health");
  assert.equal(health.status(), 200);
  const healthJson = await health.json();
  assert.equal(healthJson.version, expectedVersion);
  passed("release-identity", expectedVersion);

  const imageSources = ["usgs-mauna-loa-mlcam", "usgs-river-pequest"];
  for (const sourceKey of imageSources) {
    const image = await page.request.get(`/api/live-sources/${sourceKey}/image`);
    assert.equal(image.status(), 200, `${sourceKey} image route unavailable`);
    assert.match(image.headers()["content-type"] ?? "", /^image\//i);
    assert.equal(image.headers()["x-jalwa-live-source"], sourceKey);
    assert.match(image.headers()["cache-control"] ?? "", /s-maxage=/i);
  }
  passed("allowlisted-live-image-route", { sources: imageSources });

  await context.close();
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Public-domain live acceptance passed. Report: ${reportFile}`);
} catch (error) {
  report.checks.push({ name: "acceptance", status: "failed", detail: error instanceof Error ? error.message : String(error) });
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  throw error;
} finally {
  await browser.close();
}
