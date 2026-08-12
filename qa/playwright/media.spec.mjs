import { test, expect, devices } from "@playwright/test";
import { expectNoHorizontalOverflow, expectedReleaseSha } from "./helpers/staging.mjs";

const baseURL = (process.env.STAGING_BASE_URL ?? process.env.JALWA_BROWSER_BASE_URL ?? "").trim().replace(/\/$/, "");
const liveExpected = (process.env.JALWA_EXPECT_LIVE_SOURCES ?? "false") === "true";

const expectedLiveTitles = [
  "NASA Space Station Views", "NOAA Ocean Exploration Camera 1", "NOAA Ocean Exploration Camera 2", "NOAA Ocean Exploration Camera 3",
  "USGS Kīlauea V1", "USGS Kīlauea V2", "USGS Kīlauea V3", "USGS Mauna Loa Webcams", "USGS Rivers and Lakes",
  "European Parliament Plenary", "European Parliament Committee Rooms", "UN Web TV", "UN General Assembly", "UN Security Council", "UN Human Rights Council",
  "DVIDS Live Webcasts", "Pentagon Press Briefings", "White House Public Events via DVIDS", "U.S. Navy Recruit Training Graduations", "Defense Conferences and Ceremonies",
  "NASA+ Live Events", "NASA Mission and Launch Coverage", "NASA Space-to-Ground",
  "NPS Devils Tower Entrance", "NPS Mount Rainier Sunrise", "NPS Mount Rainier Paradise", "NPS Mount Rainier Tatoosh Range",
  "NPS Guadalupe Pine Springs Canyon", "NPS Guadalupe El Capitan", "NPS Shenandoah Mountain View", "NPS Shenandoah Big Meadows",
  "NPS Great Smoky Mountains Newfound Gap", "NPS Point Reyes Beach", "NPS Yellowstone Electric Peak", "NPS Glacier Night Sky",
  "NPS Bunker Hill Monument West View", "NPS Painted Desert Inn", "NPS El Morro National Monument",
  "NIH VideoCast", "FDA Advisory Committee Live", "SEC Public Meetings", "FCC Open Meetings and Workshops",
  "Europe by Satellite — EbS", "Europe by Satellite — EbS+", "U.S. House FloorCast", "U.S. Senate Floor Webcast",
];

const officialLinkSlugs = [
  "european-parliament-plenary", "european-parliament-committee-rooms", "un-web-tv", "un-general-assembly", "un-security-council", "un-human-rights-council",
  "dvids-live-webcasts", "dvids-pentagon-press-briefings", "dvids-white-house-public-events", "dvids-navy-recruit-graduations", "dvids-defense-conferences-ceremonies",
  "nasa-plus-live-events", "nasa-mission-launch-coverage", "nasa-space-to-ground", "nih-videocast", "fda-advisory-committee-live",
  "sec-public-meetings", "fcc-open-meetings", "europe-by-satellite-ebs", "europe-by-satellite-ebs-plus", "us-house-floorcast", "us-senate-floor-webcast",
];

test.describe("catalogue and media", () => {
  test("a published catalogue item renders a real media surface or documented safe unavailable boundary", async ({ page }) => {
    const pageErrors = [];
    const failedSameOrigin = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      try {
        const url = new URL(request.url());
        if (url.origin === new URL(baseURL).origin) failedSameOrigin.push(`${request.method()} ${url.pathname}`);
      } catch {
        // Ignore malformed third-party URLs.
      }
    });

    const explore = await page.goto("/explore", { waitUntil: "networkidle" });
    expect(explore?.status() ?? 599).toBeLessThan(500);
    const watchLinks = await page.locator('a[href^="/watch/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))]);
    expect(watchLinks.length, "At least one rights-approved published staging item is required for media certification.").toBeGreaterThan(0);

    const response = await page.goto(watchLinks[0], { waitUntil: "networkidle" });
    expect(response?.status() ?? 599).toBeLessThan(500);
    await expect(page.locator(".player-shell")).toBeVisible();

    const safeBoundary = await page.locator(".player-placeholder").isVisible().catch(() => false);
    const mediaSurfaceCount = await page.locator("video, iframe, img").count();
    expect(safeBoundary || mediaSurfaceCount > 0, "Watch page must expose media or the documented safe unavailable boundary.").toBeTruthy();
    expect(pageErrors).toEqual([]);
    expect(failedSameOrigin).toEqual([]);
  });

  test("enabled live catalogue is complete, public and mobile-safe", async ({ browser }) => {
    test.skip(!liveExpected, "Governed live sources are not enabled for this staging run.");
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      baseURL,
      locale: "en-PK",
      timezoneId: "Asia/Karachi",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      const response = await page.goto("/live", { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: /Official live public sources/i })).toBeVisible();
      const body = await page.locator("body").innerText();
      for (const title of expectedLiveTitles) expect(body).toContain(title);
      expect(body).not.toMatch(/Premium/i);
      expect(body).toMatch(/does not sponsor or endorse Jalwa/i);
      expect(body).toMatch(/official source/i);
      await expectNoHorizontalOverflow(page, "mobile live catalogue");

      const watchLinks = await page.locator('a[href^="/watch/"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("href")).filter(Boolean))]);
      expect(watchLinks.length).toBeGreaterThanOrEqual(44);

      const health = await page.request.get("/api/health");
      expect(health.status()).toBe(200);
      expect((await health.json()).version).toBe(expectedReleaseSha());
    } finally {
      await context.close();
    }
  });

  test("official-link-only live sources never render an iframe or restream boundary", async ({ page }) => {
    test.skip(!liveExpected, "Governed live sources are not enabled for this staging run.");
    for (const slug of officialLinkSlugs) {
      const response = await page.goto(`/watch/${slug}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("link", { name: /Open official live coverage/i })).toBeVisible();
      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(page.locator("body")).toContainText(/does not reproduce, restream or record/i);
    }
  });

  test("allowlisted public-domain live image routes return only image content with cache/source metadata", async ({ request }) => {
    test.skip(!liveExpected, "Governed live sources are not enabled for this staging run.");
    for (const sourceKey of ["usgs-mauna-loa-mlcam", "usgs-river-pequest", "nps-devils-tower-entrance"]) {
      const response = await request.get(`/api/live-sources/${sourceKey}/image`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"] ?? "").toMatch(/^image\//i);
      expect(response.headers()["x-jalwa-live-source"]).toBe(sourceKey);
      expect(response.headers()["cache-control"] ?? "").toMatch(/s-maxage=/i);
    }
  });
});
