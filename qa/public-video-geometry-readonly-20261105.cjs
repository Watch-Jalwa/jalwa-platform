const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.JALWA_PLAYWRIGHT_PATH);
const slugs = [
  "mossy-tree-cc0", "baking-cookies-cc0", "ocean-surface-waves-cc0", "tiny-waterfall-cc0",
  "tree-trimmer-cc0", "counting-chisenbop-cc0", "vanellus-vanellus-cc0",
  "how-fossils-form-cc-by", "eso-cast-254-light", "eso-cast-265-light",
  "proxima-centauri-flythrough-cc-by", "invitation-to-pakistan-nara",
  "promise-of-pakistan-geography", "wikipedia-science-comms-cc-by",
  "big-buck-bunny", "elephants-dream"
];
const productionSlugs = slugs.slice(0, 7);
const reports = [];
const out = "public-video-geometry-evidence";
async function capture(browser, origin, slug, device) {
  const viewport = device === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({
    viewport,
    ...(device === "mobile" ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    javaScriptEnabled: true,
    locale: "en-PK",
    timezoneId: "Asia/Karachi",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const url = origin + "/watch/" + slug;
  const entry = { site: origin === "https://watch-jalwa.com" ? "live" : "staging", slug, device, requestedUrl: url, viewport };
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 18000 });
    entry.httpStatus = response?.status() ?? null;
    await page.locator(".player-shell").first().waitFor({ state: "attached", timeout: 12000 }).catch(() => {});
    await page.locator("video").first().waitFor({ state: "attached", timeout: 12000 }).catch(() => {});
    const hasVideo = await page.locator("video").count() > 0;
    if (hasVideo) {
      await page.waitForFunction(
        () => { const v = document.querySelector(".player-shell video"); return Boolean(v && v.videoWidth > 0 && v.videoHeight > 0); },
        null, { timeout: 13000 }
      ).catch(() => {});
      // Read-only playback check. Do not expose the signed media URL or token.
      await page.locator(".player-shell video").first().evaluate(async (video) => {
        video.muted = true;
        if (video.readyState > 0) await Promise.race([
          video.play().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1800))
        ]);
      }).catch(() => {});
      await page.waitForTimeout(1250);
    }
    entry.measurement = await page.evaluate(() => {
      const shell = document.querySelector(".player-shell");
      const frame = document.querySelector(".self-hosted-media-frame");
      const v = document.querySelector(".player-shell video");
      const rect = (node) => { const r = node?.getBoundingClientRect(); return r ? { width: Math.round(r.width), height: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null; };
      const videoStyle = v ? getComputedStyle(v) : null;
      const shellStyle = shell ? getComputedStyle(shell) : null;
      const videoRect = rect(v);
      const decodedAspect = v && v.videoHeight ? v.videoWidth / v.videoHeight : null;
      const frameRect = rect(frame) || rect(shell);
      return {
        heading: (document.querySelector("h1")?.textContent || "").trim().slice(0, 150),
        videoElementFound: Boolean(v),
        decodedWidth: v?.videoWidth || null,
        decodedHeight: v?.videoHeight || null,
        decodedAspect,
        currentTime: v ? Math.round(v.currentTime * 1000) / 1000 : null,
        readyState: v?.readyState ?? null,
        videoErrorCode: v?.error?.code ?? null,
        paused: v?.paused ?? null,
        videoRect,
        frameRect,
        shellRect: rect(shell),
        playerShellCssAspect: shellStyle?.aspectRatio ?? null,
        playerShellCssMaxHeight: shellStyle?.maxHeight ?? null,
        videoCssObjectFit: videoStyle?.objectFit ?? null,
        videoCssMaxHeight: videoStyle?.maxHeight ?? null,
        frameAspect: frameRect && frameRect.height ? frameRect.width / frameRect.height : null,
      };
    });
    if (entry.measurement.decodedAspect && entry.measurement.frameAspect) {
      entry.aspectMismatch = Math.abs(entry.measurement.decodedAspect - entry.measurement.frameAspect) > 0.035;
    } else {
      entry.aspectMismatch = null;
    }
    const file = entry.site + "-" + slug + "-" + device + ".png";
    await page.screenshot({ path: path.join(out, file), fullPage: false, animations: "disabled", timeout: 10000 }).catch(() => {});
  } catch (error) {
    entry.diagnosticError = (error?.message ?? String(error)).split("\n")[0].slice(0, 250);
  } finally {
    await context.close();
  }
  return entry;
}
async function main() {
  await fs.mkdir(out, { recursive: true });
  const jobs = [
    ...slugs.flatMap((slug) => [
      { origin: "https://jalwa-platform.codistan.org", slug, device: "desktop" },
      { origin: "https://jalwa-platform.codistan.org", slug, device: "mobile" },
    ]),
    ...productionSlugs.map((slug) => ({ origin: "https://watch-jalwa.com", slug, device: "desktop" })),
  ];
  const browser = await chromium.launch({ headless: true });
  let index = 0;
  try {
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (index < jobs.length) {
        const item = jobs[index++];
        const result = await capture(browser, item.origin, item.slug, item.device);
        reports.push(result);
        console.log("READ-ONLY " + result.site + " " + result.slug + " " + result.device + " HTTP=" + result.httpStatus + " video=" + Boolean(result.measurement?.videoElementFound) + " decoded=" + (result.measurement?.decodedWidth || 0) + "x" + (result.measurement?.decodedHeight || 0) + " mismatch=" + result.aspectMismatch);
      }
    }));
  } finally {
    await browser.close();
  }
  reports.sort((a, b) => [a.site, a.slug, a.device].join("|").localeCompare([b.site, b.slug, b.device].join("|")));
  const summary = {
    generatedAt: new Date().toISOString(),
    diagnosticOnly: true,
    notes: [
      "Read-only, guest Chromium inspection. Mobile is emulated Chromium, not physical Android or iPhone Safari.",
      "Decoded videoWidth/videoHeight cannot detect black padding baked into encoded pixels; screenshots and source-level ffprobe/pixel analysis are required.",
      "A successful diagnostic job does not mean any video is fixed, all rights are approved, or production deployment is authorized.",
      "No signed playback URLs, media tokens, cookies, credentials or underlying media URLs are recorded.",
    ],
    total: reports.length,
    withVideoElement: reports.filter((r) => r.measurement?.videoElementFound).length,
    withMetadata: reports.filter((r) => r.measurement?.decodedWidth && r.measurement?.decodedHeight).length,
    withAspectMismatch: reports.filter((r) => r.aspectMismatch === true).length,
    withErrors: reports.filter((r) => r.diagnosticError).length,
    reports,
  };
  await fs.writeFile(path.join(out, "geometry.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log("GEOMETRY_RESULT " + JSON.stringify({ total: summary.total, withVideoElement: summary.withVideoElement, withMetadata: summary.withMetadata, withAspectMismatch: summary.withAspectMismatch, withErrors: summary.withErrors }));
}
main().catch((e) => { console.error("Read-only browser QA setup failed: " + e.message); process.exitCode = 1; });
