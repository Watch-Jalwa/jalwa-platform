#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [resultDir, area, status, ...summaryParts] = process.argv.slice(2);
const summary = summaryParts.join(" ").trim();
const allowedStatuses = new Set(["PASS", "FAIL", "BLOCKED", "N/A", "VISUAL REVIEW REQUIRED"]);

if (!resultDir || !/^[a-z0-9_-]+$/.test(area ?? "") || !allowedStatuses.has(status) || !summary) {
  console.error("usage: write-certification-result.mjs <dir> <area> <status> <summary>");
  process.exit(2);
}

const secretPattern = /(authorization|bearer\s+[a-z0-9._-]+|cookie|password|secret|service[_-]?role|api[_-]?key|access[_-]?token)/i;
if (secretPattern.test(summary)) {
  console.error("Refusing to write a result summary that may contain secret material.");
  process.exit(2);
}

await mkdir(resultDir, { recursive: true });
const payload = {
  schema_version: 1,
  area,
  status,
  summary,
  recorded_at: new Date().toISOString(),
};
await writeFile(path.join(resultDir, `${area}.json`), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
console.log(`${area}: ${status}`);
