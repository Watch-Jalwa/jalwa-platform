import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  plans: new URL("../lib/payments/plans.ts", import.meta.url),
  access: new URL("../lib/premium/access.ts", import.meta.url),
  benefits: new URL("../lib/premium/benefits.ts", import.meta.url),
  playback: new URL("../app/api/playback/[contentId]/token/route.ts", import.meta.url),
  ads: new URL("../components/jalwa-ad-slot.tsx", import.meta.url),
  ai: new URL("../app/api/ai/query/route.ts", import.meta.url),
  catalogue: new URL("../lib/catalogue/repository.ts", import.meta.url),
  migration: new URL("../../../database/migrations/202609240001_premium_benefit_delivery.sql", import.meta.url),
};

async function text(url) {
  return readFile(url, "utf8");
}

test("Premium plan advertises the six implemented product benefits", async () => {
  const [plans, benefits] = await Promise.all([text(files.plans), text(files.benefits)]);
  for (const code of ["premium_catalogue", "early_access", "jalwa_ads_free", "enhanced_quality", "ai_plus", "premium_collections"]) {
    assert.ok(benefits.includes(`"${code}"`));
  }
  for (const label of [
    "Full authorised Jalwa catalogue",
    "Jalwa Originals and early access",
    "Ad-free Jalwa interface",
    "Enhanced playback quality",
    "Larger Ask Jalwa allowance",
    "Premium collections",
  ]) {
    assert.ok(plans.includes(label));
  }
});

test("each Premium entitlement has a real backend consumer", async () => {
  const [playback, ads, ai, catalogue, migration] = await Promise.all([
    text(files.playback),
    text(files.ads),
    text(files.ai),
    text(files.catalogue),
    text(files.migration),
  ]);
  assert.match(playback, /p_benefit: "premium_catalogue"/);
  assert.match(playback, /p_benefit: "enhanced_quality"/);
  assert.match(playback, /480p\/index\.m3u8/);
  assert.match(ads, /jalwa_ads_free/);
  assert.match(ai, /p_benefit: "ai_plus"/);
  assert.match(catalogue, /premium_collections/);
  assert.match(migration, /has_active_benefit\('early_access'\)/);
  assert.match(migration, /has_active_benefit\('premium_collections'\)/);
});

test("Premium policy helpers define 5-to-50 AI and 480p-to-720p playback tiers", async () => {
  const benefits = await text(files.benefits);
  assert.ok(benefits.includes("50"));
  assert.ok(benefits.includes("5"));
  assert.ok(benefits.includes("maxHeight: 720"));
  assert.ok(benefits.includes("maxHeight: 480"));
});

test("Premium benefit checks remain server-authoritative", async () => {
  const access = await text(files.access);
  assert.match(access, /createClient/);
  assert.match(access, /auth\.getUser/);
  assert.match(access, /has_active_benefit/);
  assert.doesNotMatch(access, /localStorage|sessionStorage|document\./);
});
