import test from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_BENEFIT_CODES, resolveAiDailyLimit, resolvePlaybackQuality } from "../lib/premium/benefits.ts";

test("Premium plan has exactly six product benefit codes", () => {
  assert.deepEqual([...PREMIUM_BENEFIT_CODES].sort(), [
    "ai_plus",
    "early_access",
    "enhanced_quality",
    "jalwa_ads_free",
    "premium_catalogue",
    "premium_collections",
  ]);
});

test("AI Plus resolves free and Premium daily allowances", () => {
  assert.equal(resolveAiDailyLimit(false), 5);
  assert.equal(resolveAiDailyLimit(true), 50);
  assert.equal(resolveAiDailyLimit(false, { free: 7, premium: 70 }), 7);
  assert.equal(resolveAiDailyLimit(true, { free: 7, premium: 70 }), 70);
});

test("enhanced quality has an explicit server-enforceable ceiling", () => {
  assert.deepEqual(resolvePlaybackQuality(false), { tier: "standard", maxHeight: 480 });
  assert.deepEqual(resolvePlaybackQuality(true), { tier: "premium", maxHeight: 720 });
});
