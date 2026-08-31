import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

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

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest?.schema_version !== 1 || typeof manifest?.baselines !== "object") {
  throw new Error("Visual baseline manifest is invalid.");
}

test.describe("public visual regression", () => {
  for (const [name, route] of routes) {
    test(`${name} matches its human-approved staging baseline`, async ({ page }, testInfo) => {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status() ?? 599).toBeLessThan(500);
      await page.evaluate(() => {
        document.querySelectorAll("video").forEach((element) => element.pause?.());
        document.querySelectorAll("[data-visual-dynamic]").forEach((element) => element.setAttribute("style", "visibility:hidden!important"));
      });

      const screenshot = await page.screenshot({
        path: testInfo.outputPath(`visual-${name}.png`),
        fullPage: true,
        animations: "disabled",
        caret: "hide",
      });
      const actual = digest(screenshot);
      const approved = manifest.baselines?.[name]?.sha256 ?? null;
      expect(approved, `VISUAL REVIEW REQUIRED: ${name} has no human-approved baseline SHA-256.`).toBeTruthy();
      expect(actual, `VISUAL REVIEW REQUIRED: ${name} differs from the human-approved baseline.`).toBe(approved);
    });
  }
});
