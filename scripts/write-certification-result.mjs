#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const [resultDir, area, status, ...rawSummaryParts] = args;
let testCount = 1;
if (/^tests=\d+$/.test(rawSummaryParts.at(-1) ?? "")) {
  testCount = Number(rawSummaryParts.pop().slice("tests=".length));
}
const summary = rawSummaryParts.join(" ").trim();
const allowedStatuses = new Set(["PASS", "FAIL", "BLOCKED", "N/A", "VISUAL REVIEW REQUIRED"]);

if (!resultDir || !/^[a-z0-9_-]+$/.test(area ?? "") || !allowedStatuses.has(status) || !summary || !Number.isInteger(testCount) || testCount < 1 || testCount > 10_000) {
  console.error("usage: write-certification-result.mjs <dir> <area> <status> <summary> [tests=N]");
  process.exit(2);
}

const secretPattern = /(authorization|bearer\s+[a-z0-9._-]+|cookie|password|secret|service[_-]?role|api[_-]?key|access[_-]?token)/i;
if (secretPattern.test(summary)) {
  console.error("Refusing to write a result summary that may contain sensitive material.");
  process.exit(2);
}

await mkdir(resultDir, { recursive: true });
const payload = {
  schema_version: 1,
  area,
  status,
  test_count: testCount,
  summary,
  recorded_at: new Date().toISOString(),
};
await writeFile(path.join(resultDir, `${area}.json`), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
console.log(`${area}: ${status}`);
