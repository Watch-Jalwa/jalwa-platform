import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREMIUM_BENEFIT_CODES, resolveAiDailyLimit, selectPlaybackAuthorizationPrefix, selectPlaybackPath } from "../lib/premium/benefits.mjs";

const migrationUrl = new URL("../../../database/migrations/202609250001_premium_benefit_delivery.sql", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);
const premiumPageUrl = new URL("../app/premium/page.tsx", import.meta.url);
const playbackUrl = new URL("../app/api/playback/[contentId]/token/route.ts", import.meta.url);
const aiUrl = new URL("../app/api/ai/query/route.ts", import.meta.url);
const customerSpecUrl = new URL("../../../qa/playwright/customer.spec.mjs", import.meta.url);
const premiumFixtureUrl = new URL("../app/api/internal/qa/premium-features/route.ts", import.meta.url);

test("Premium benefit registry contains every commercial promise", () => {
  assert.deepEqual([...PREMIUM_BENEFIT_CODES].sort(), ["ai_plus","early_access","enhanced_quality","jalwa_ads_free","premium_catalogue","premium_collections"].sort());
});

test("AI Plus resolves a larger deterministic allowance", () => {
  assert.equal(resolveAiDailyLimit(false), 5);
  assert.equal(resolveAiDailyLimit(true), 50);
  assert.equal(resolveAiDailyLimit(true, 7, 70), 70);
});

test("enhanced quality gets the master ladder while standard is capped to 480p", () => {
  const path = "processed/c/a/master.m3u8";
  assert.equal(selectPlaybackPath(path, "hls", false).mediaPath, "processed/c/a/480p/index.m3u8");
  assert.equal(selectPlaybackPath(path, "hls", false).maxHeight, 480);
  assert.equal(selectPlaybackPath(path, "hls", true).mediaPath, path);
  assert.equal(selectPlaybackPath(path, "hls", true).maxHeight, 720);
  assert.equal(selectPlaybackAuthorizationPrefix("processed/c/a/", "processed/c/a/480p/index.m3u8", "hls", false), "processed/c/a/480p/");
  assert.equal(selectPlaybackAuthorizationPrefix("processed/c/a/", path, "hls", true), "processed/c/a/");
});

test("database policies enforce early access and Premium collections", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const hardening = await readFile(new URL("../../../database/migrations/202609250002_premium_benefit_enforcement_hardening.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("has_active_benefit('early_access')"));
  assert.ok(sql.includes("has_active_benefit('premium_collections')"));
  assert.ok(sql.includes("is_content_effectively_available_for_viewer"));
  assert.ok(hardening.includes("has_active_benefit('early_access')"));
  assert.doesNotMatch(hardening, /has_internal_alpha_access/);
});

test("frontend consumes ad-free, quality, AI and Premium hub state", async () => {
  const [layout, premiumPage, playback, ai] = await Promise.all([layoutUrl,premiumPageUrl,playbackUrl,aiUrl].map((url) => readFile(url, "utf8")));
  assert.ok(layout.includes("JalwaAdSlot"));
  assert.ok(premiumPage.includes("premium-early-access"));
  assert.ok(premiumPage.includes("premium-collections"));
  assert.ok(playback.includes("selectPlaybackPath"));
  assert.ok(playback.includes("selectPlaybackAuthorizationPrefix"));
  assert.ok(playback.includes("authorizedPathPrefix"));
  assert.ok(playback.includes("pathPrefix: authorizedPathPrefix"));
  assert.ok(playback.includes("enhanced_quality"));
  assert.ok(ai.includes("resolveAiDailyLimit"));
});

test("staging browser suite names every Premium benefit journey", async () => {
  const spec = (await readFile(customerSpecUrl, "utf8")).toLowerCase();
  for (const marker of ["premium catalogue access", "early access original", "ad-free interface", "enhanced playback quality", "ask jalwa allowance", "premium collections"]) {
    assert.ok(spec.includes(marker), "missing browser coverage marker: " + marker);
  }
});


test("Premium staging fixture satisfies production rights-approval requirements", async () => {
  const fixture = await readFile(premiumFixtureUrl, "utf8");
  for (const marker of ["evidence_url", "evidence_note", "takedown_contact", "commercial_use_confirmed", "self_hosting_confirmed"]) {
    assert.ok(fixture.includes(marker), "Premium QA fixture is missing rights field: " + marker);
  }
});
