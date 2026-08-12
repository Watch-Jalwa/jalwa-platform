#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.STAGING_BASE_URL ?? "").trim().replace(/\/$/, "");
const evidenceDir = process.env.CERTIFICATION_EVIDENCE_DIR || "/tmp/jalwa-staging-certification";
const manifestPath = process.env.VISUAL_BASELINE_MANIFEST || "qa/visual-baselines/manifest.json";
const routes = [
  ["home", "/"],
  ["explore", "/explore"],
  ["pricing", "/pricing"],
  ["login", "/login"],
];

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  if (!/^https:\/\//.test(baseUrl)) {
    console.error("BLOCKED: STAGING_BASE_URL must be a protected HTTPS staging URL.");
    process.exit(2);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest?.schema_version !== 1 || typeof manifest?.baselines !== "object") throw new Error("Visual baseline manifest is invalid.");

  await mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const captures = [];

  try {
    for (const [name, route] of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
      if (!response || response.status() >= 500) throw new Error(`Visual route ${route} returned HTTP ${response?.status() ?? "none"}.`);
      await page.evaluate(() => {
        document.querySelectorAll("video").forEach((element) => element.pause?.());
        document.querySelectorAll("[data-visual-dynamic]").forEach((element) => element.setAttribute("style", "visibility:hidden!important"));
      });
      const file = path.join(evidenceDir, `visual-${name}.png`);
      const buffer = await page.screenshot({ path: file, fullPage: true, animations: "disabled", caret: "hide" });
      const sha256 = digest(buffer);
      const approved = manifest.baselines?.[name]?.sha256 ?? null;
      captures.push({ name, route, sha256, approved_sha256: approved, status: approved === sha256 ? "PASS" : "VISUAL REVIEW REQUIRED" });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const evidence = { schema_version: 1, captures, recorded_at: new Date().toISOString() };
  await writeFile(path.join(evidenceDir, "visual-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

  const reviews = captures.filter((item) => item.status !== "PASS");
  if (reviews.length) {
    console.error(`VISUAL REVIEW REQUIRED: ${reviews.map((item) => item.name).join(", ")}. CI did not update the human-approved baseline manifest.`);
    process.exit(3);
  }
  console.log(`Visual regression passed (${captures.length} approved public baselines).`);
}

main().catch((error) => {
  console.error(`Visual staging certification failed: ${error.message}`);
  process.exitCode = 1;
});
