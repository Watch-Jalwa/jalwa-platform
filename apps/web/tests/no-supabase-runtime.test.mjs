import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const roots = ["apps", "infrastructure", "qa", "scripts", ".github/workflows"];
const ignored = new Set([
  "apps/web/tests/no-supabase-runtime.test.mjs",
  "package-lock.json",
]);
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".sh", ".sql", ".env", ".tf", ".tftpl"]);
const explicitFiles = ["Dockerfile", "package.json", ".env.example"];

async function filesUnder(relative) {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (extensions.has(path.extname(entry.name)) || entry.name.startsWith(".env")) files.push(child.replaceAll("\\", "/"));
  }
  return files;
}

test("active runtime, deployment and QA code has no Supabase dependency", async () => {
  const offenders = [];
  for (const directory of roots) {
    for (const relative of await filesUnder(directory)) {
      if (ignored.has(relative)) continue;
      const source = await readFile(path.join(root, relative), "utf8");
      if (/supabase|@supabase/i.test(source)) offenders.push(relative);
    }
  }
  for (const relative of explicitFiles) {
    const source = await readFile(path.join(root, relative), "utf8");
    if (/supabase|@supabase/i.test(source)) offenders.push(relative);
  }
  assert.deepEqual(offenders, [], `Supabase references remain in active code/config:\n${offenders.join("\n")}`);
});
