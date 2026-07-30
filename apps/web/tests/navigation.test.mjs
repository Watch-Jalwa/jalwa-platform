import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const manifest = readFileSync(new URL("../app/manifest.ts", import.meta.url), "utf8");

test("PWA manifest keeps a standalone mobile experience", () => {
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /name: "Jalwa"/);
});
