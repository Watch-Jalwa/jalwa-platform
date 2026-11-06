import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Load the actual capacity guard without executing the live database entrypoint.
const source = readFileSync(new URL("./repair.mjs", import.meta.url), "utf8");
const match = source.match(/^function checkCapacity\([^)]*\)\s*\{[\s\S]*?^\}/m);
assert(match, "Capacity guard boundary changed");
const checkCapacity = Function("assert", match[0] + "\nreturn checkCapacity;")(assert);
const mib = 1024 * 1024;
const gib = 1024 * mib;
const sintelBytes = 673935402;

test("an exhausted worker tmpfs rejects cached and uncached work", () => {
  assert.throws(() => checkCapacity(0, sintelBytes, sintelBytes, false), {code:"ERR_ASSERTION"});
  assert.throws(() => checkCapacity(0, gib, 0, true), {code:"ERR_ASSERTION"});
});

test("a cached Sintel original needs one GiB of free output capacity", () => {
  assert.equal(checkCapacity(gib, sintelBytes, sintelBytes, false), gib);
  assert.throws(() => checkCapacity(gib - 1, sintelBytes, sintelBytes, false), {code:"ERR_ASSERTION"});
});

test("the download budget accounts for bytes already held in the source cache", () => {
  const uncachedRequired = sintelBytes + gib;
  assert.equal(checkCapacity(uncachedRequired, sintelBytes, 0, false), uncachedRequired);
  assert.throws(() => checkCapacity(uncachedRequired - 1, sintelBytes, 0, false), {code:"ERR_ASSERTION"});
  assert.equal(uncachedRequired - checkCapacity(gib, sintelBytes, sintelBytes, false), sintelBytes);
  assert.equal(checkCapacity(sintelBytes + gib - mib, sintelBytes, mib, false), sintelBytes + gib - mib);
  assert.equal(checkCapacity(gib, sintelBytes, sintelBytes + mib, false), gib);
});

test("an uncached one-GiB short source also reserves 256 MiB for output", () => {
  const required = gib + 256 * mib;
  assert.equal(checkCapacity(required, gib, 0, true), required);
  assert.throws(() => checkCapacity(required - 1, gib, 0, true), {code:"ERR_ASSERTION"});
  assert.equal(checkCapacity(256 * mib, gib, gib, true), 256 * mib);
});
