#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const resultDir = process.argv[2];
if (!resultDir) {
  console.error("usage: finalize-staging-certification.mjs <result-dir>");
  process.exit(2);
}

const mandatoryAreas = [
  "deployment_identity",
  "api_runtime",
  "public_browser",
  "authenticated_checkout",
  "payments",
  "studio_authorization",
  "media_catalogue",
  "mobile_purchase",
  "visual_regression",
];
const allowedStatuses = new Set(["PASS", "FAIL", "BLOCKED", "N/A", "VISUAL REVIEW REQUIRED"]);
const visualAccepted = process.env.VISUAL_REVIEW_ACCEPTED === "true";
const visualAcceptanceReference = (process.env.VISUAL_REVIEW_ACCEPTANCE_REFERENCE ?? "").trim();

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readArea(area) {
  try {
    const payload = JSON.parse(await readFile(path.join(resultDir, `${area}.json`), "utf8"));
    if (payload?.area !== area || !allowedStatuses.has(payload?.status) || typeof payload?.summary !== "string") {
      throw new Error("invalid result schema");
    }
    return payload;
  } catch (error) {
    return {
      schema_version: 1,
      area,
      status: "BLOCKED",
      summary: `Mandatory certification result missing or invalid: ${error.message}`,
      recorded_at: new Date().toISOString(),
    };
  }
}

await mkdir(resultDir, { recursive: true });
const areas = [];
for (const area of mandatoryAreas) areas.push(await readArea(area));

for (const result of areas) {
  if (result.status === "VISUAL REVIEW REQUIRED") {
    if (visualAccepted && visualAcceptanceReference) {
      result.status = "PASS";
      result.summary = `${result.summary} Accepted by explicit visual review reference ${visualAcceptanceReference}.`;
    } else {
      result.status = "BLOCKED";
      result.summary = `${result.summary} Explicit visual approval is required before UAT.`;
    }
  }
}

let decision = "READY FOR UAT";
if (areas.some((item) => item.status === "FAIL")) decision = "FAILED";
else if (areas.some((item) => item.status === "BLOCKED")) decision = "BLOCKED";
else if (areas.some((item) => item.status === "N/A")) decision = "BLOCKED";

const report = {
  schema_version: 1,
  qa_run_id: process.env.QA_RUN_ID || null,
  release_sha: process.env.RELEASE_SHA || null,
  deployment_pipeline_id: process.env.DEPLOYMENT_PIPELINE_ID || null,
  staging_url: process.env.STAGING_BASE_URL || null,
  generated_at: new Date().toISOString(),
  decision,
  totals: {
    pass: areas.filter((item) => item.status === "PASS").length,
    fail: areas.filter((item) => item.status === "FAIL").length,
    blocked: areas.filter((item) => item.status === "BLOCKED").length,
    not_applicable: areas.filter((item) => item.status === "N/A").length,
  },
  areas,
};

const jsonPath = path.join(resultDir, "certification-report.json");
const markdownPath = path.join(resultDir, "certification-report.md");
const htmlPath = path.join(resultDir, "certification-report.html");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
const rows = areas.map((item) => `| ${item.area} | ${item.status} | ${item.summary.replaceAll("|", "\\|")} |`).join("\n");
const markdown = `# Jalwa staging certification\n\n**Decision: ${decision}**\n\n- Release SHA: \`${report.release_sha ?? "unknown"}\`\n- Deployment pipeline: \`${report.deployment_pipeline_id ?? "unknown"}\`\n- QA run: \`${report.qa_run_id ?? "unknown"}\`\n- Generated: ${report.generated_at}\n\n| Area | Status | Evidence summary |\n| --- | --- | --- |\n${rows}\n`;
await writeFile(markdownPath, markdown, { mode: 0o600 });

const htmlRows = areas.map((item) => `<tr><td>${htmlEscape(item.area)}</td><td>${htmlEscape(item.status)}</td><td>${htmlEscape(item.summary)}</td></tr>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Jalwa staging certification</title><meta name="robots" content="noindex,nofollow"><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.6rem;text-align:left;vertical-align:top}code{overflow-wrap:anywhere}</style></head><body><h1>Jalwa staging certification</h1><p><strong>Decision: ${htmlEscape(decision)}</strong></p><ul><li>Release SHA: <code>${htmlEscape(report.release_sha ?? "unknown")}</code></li><li>Deployment pipeline: <code>${htmlEscape(report.deployment_pipeline_id ?? "unknown")}</code></li><li>QA run: <code>${htmlEscape(report.qa_run_id ?? "unknown")}</code></li><li>Generated: ${htmlEscape(report.generated_at)}</li></ul><table><thead><tr><th>Area</th><th>Status</th><th>Evidence summary</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
await writeFile(htmlPath, html, { mode: 0o600 });

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `decision=${decision}\n`, { flag: "a" });
}
console.log(decision);
