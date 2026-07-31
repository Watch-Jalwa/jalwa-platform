import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryUrl = new URL("../lib/live-sources/registry.ts", import.meta.url);
const securityUrl = new URL("../lib/live-sources/security.ts", import.meta.url);
const imageRouteUrl = new URL("../app/api/live-sources/[sourceKey]/image/route.ts", import.meta.url);
const healthUrl = new URL("../app/api/cron/source-health/route.ts", import.meta.url);
const watchUrl = new URL("../app/watch/[slug]/page.tsx", import.meta.url);
const livePageUrl = new URL("../app/live/page.tsx", import.meta.url);
const migrationUrl = new URL("../../../supabase/migrations/202608010001_public_domain_live_sources.sql", import.meta.url);
const seedUrl = new URL("../../../scripts/seed-public-domain-live-sources.sql", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/public-domain-live-acceptance.mjs", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/staging-acceptance.yml", import.meta.url);
const cssUrl = new URL("../app/phase9.css", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("registry contains only the approved NASA, NOAA and USGS launch scope", async () => {
  const registry = await text(registryUrl);
  for (const key of [
    "nasa-space-station-views", "noaa-ocean-camera-1", "noaa-ocean-camera-2", "noaa-ocean-camera-3",
    "usgs-kilauea-v1", "usgs-kilauea-v2", "usgs-kilauea-v3", "usgs-mauna-loa-live", "usgs-rivers-lakes-live",
  ]) assert.match(registry, new RegExp(key));
  assert.match(registry, /TOP_LEVEL_LIVE_SOURCE_KEYS/);
  assert.match(registry, /PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED === "true"/);
  assert.doesNotMatch(registry, /\bPTV\b|\bARY\b|Geo News|\bsports\b|Tamasha|Tapmad/i);
  assert.doesNotMatch(registry, /accessLevel:\s*"premium"/i);
});

test("live image delivery is an allowlisted source-key route and not a generic proxy", async () => {
  const [security, route] = await Promise.all([text(securityUrl), text(imageRouteUrl)]);
  assert.match(security, /assertAllowedPublicHttps/);
  assert.match(security, /private or reserved address/);
  assert.match(security, /MAX_REDIRECTS = 3/);
  assert.match(security, /IMAGE_LIMIT_BYTES/);
  assert.match(security, /IMAGE_TYPES/);
  assert.match(route, /getLiveSourceDefinition\(sourceKey\)/);
  assert.match(route, /public_domain_live_image/);
  assert.match(route, /x-jalwa-live-source/);
  assert.match(route, /s-maxage=/);
  assert.doesNotMatch(route, /searchParams|get\("url"\)|new URL\(request\.url\).*url/i);
});

test("schema makes rights review, public access and enablement separate fail-closed gates", async () => {
  const migration = await text(migrationUrl);
  assert.match(migration, /add value if not exists 'noaa'/i);
  assert.match(migration, /add value if not exists 'usgs'/i);
  assert.match(migration, /live_delivery_adapter/);
  assert.match(migration, /official_live_embed/);
  assert.match(migration, /public_domain_live_image/);
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /next_review_at/);
  assert.match(migration, /approved agency live sources must remain public/);
  assert.match(migration, /current live-source rights review required/);
  assert.match(migration, /playback_source_health/);
  assert.match(migration, /off_air/);
});

test("staging seed never publishes or enables external live sources", async () => {
  const seed = await text(seedUrl);
  assert.match(seed, /fixtures may run only in staging/);
  assert.match(seed, /'draft'/);
  assert.match(seed, /'pending'/);
  assert.match(seed, /enabled,false|false,'content-operations'/);
  assert.doesNotMatch(seed, /'published'.*NASA Space Station Views/s);
  assert.match(seed, /usgs-mauna-loa-live/);
  assert.match(seed, /usgs-rivers-lakes-live/);
});

test("provider-aware health distinguishes off-air, stale, overdue and repeated failures", async () => {
  const health = await text(healthUrl);
  assert.match(health, /checkLiveSource/);
  assert.match(health, /reviewDue/);
  assert.match(health, /offAir/);
  assert.match(health, /failures >= 3/);
  assert.match(health, /terms_review_due/);
  assert.match(health, /content_hash/);
  assert.match(health, /last_success_at/);
});

test("mobile live experience preserves official players, attribution and non-endorsement", async () => {
  const [watch, livePage, css] = await Promise.all([text(watchUrl), text(livePageUrl), text(cssUrl)]);
  assert.match(watch, /OfficialLiveEmbedPlayer/);
  assert.match(watch, /PublicDomainLiveImagePlayer/);
  assert.match(watch, /does not sponsor or endorse Jalwa/);
  assert.match(livePage, /Official live public sources/);
  assert.match(livePage, /does not restream, record or place advertising over/);
  assert.match(livePage, /do not sponsor or endorse Jalwa/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /aspect-ratio: 16\/9/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(watch, /autoplay=1/);
});

test("staging acceptance proves the source inventory only when explicitly enabled", async () => {
  const [acceptance, workflow] = await Promise.all([text(acceptanceUrl), text(workflowUrl)]);
  assert.match(acceptance, /width: 390, height: 844/);
  assert.match(acceptance, /does not sponsor or endorse Jalwa/);
  assert.match(acceptance, /x-jalwa-live-source/);
  assert.match(acceptance, /Premium/);
  assert.match(workflow, /seed-public-domain-live-sources\.sql/);
  assert.match(workflow, /public-domain-live-acceptance\.mjs/);
  assert.match(workflow, /JALWA_EXPECT_LIVE_SOURCES/);
});
