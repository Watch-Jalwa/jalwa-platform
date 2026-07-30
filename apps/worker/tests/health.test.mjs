import assert from "node:assert/strict";
import test from "node:test";
import { buildHealth } from "../src/index.mjs";

test("worker health is stable", () => {
  assert.equal(buildHealth().service, "jalwa-worker");
  assert.equal(buildHealth().status, "ready");
});
