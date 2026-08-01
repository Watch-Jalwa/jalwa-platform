import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryUrl = new URL("../lib/live-sources/registry.ts", import.meta.url);
const securityUrl = new URL("../lib/live-sources/security.ts", import.meta.url);
const imageRouteUrl = new URL("../app/api/live-sources/[sourceKey]/image/route.ts", import.meta.url);
const healthUrl = new URL("../app/api/cron/source-health/route.ts", import.meta.url);
const watchUrl = new URL("../app/watch/[slug]/page.tsx", import.meta.url);
const livePageUrl = new URL("../app/live/page.tsx", import.meta.url);
const contractMigrationUrl = new URL("../../../supabase/migrations/202608010001_public_domain_live_sources.sql", import.meta.url);
const approvedMigrationUrl = new URL("../../../supabase/migrations/202608010002_approved_public_domain_live_inventory.sql", import.meta.url);
const seedUrl = new URL("../../../scripts/seed-public-domain-live-sources.sql", import.meta.url);
const stateUrl = new URL("../../../scripts/set-public-domain-live-catalogue-state.sql", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/public-domain-live-acceptance.mjs", import.meta.url);
const stagingWorkflowUrl = new URL("../../../.github/workflows/staging-acceptance.yml", import.meta.url);
const activationWorkflowUrl = new URL("../../../.github/workflows/set-public-domain-live-sources.yml", import.meta.url);
const cssUrl = new URL("../app/phase9.css", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("registry preserves the approved NASA, NOAA and USGS launch scope", async () => {
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

test("schema keeps rights, publication and runtime enablement as separate fail-closed gates", async () => {
  const migration = await text(contractMigrationUrl);
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /next_review_at/);
  assert.match(migration, /approved agency live sources must remain public/);
  assert.match(migration, /current live-source rights review required/);
  assert.match(migration, /playback_source_health/);
  assert.match(migration, /off_air/);
});

test("approved inventory migration records owner approval without auto-publishing", async () => {
  const migration = await text(approvedMigrationUrl);
  for (const key of [
    "nasa-space-station-views", "noaa-ocean-camera-1", "noaa-ocean-camera-2", "noaa-ocean-camera-3",
    "usgs-kilauea-v1", "usgs-kilauea-v2", "usgs-kilauea-v3",
    "usgs-mauna-loa-mlcam", "usgs-mauna-loa-mtcam", "usgs-mauna-loa-mk2cam", "usgs-mauna-loa-mkcam",
    "usgs-river-pequest", "usgs-river-delaware-belvidere", "usgs-lake-hopatcong", "usgs-river-rancocas",
  ]) assert.match(migration, new RegExp(key));
  assert.match(migration, /'approved'/);
  assert.match(migration, /2026-08-01 09:51:00\+00/);
  assert.match(migration, /2026-10-30 09:51:00\+00/);
  assert.match(migration, /'public_domain_live_image','self_host_open'/);
  assert.match(migration, /'official_live_embed','embed_only'/);
  assert.match(migration, /false,'content-operations'/);
  assert.match(migration, /'editorial_review'/);
  assert.doesNotMatch(migration, /select .*'published'.*approved_live_inventory/s);
});

test("staging compatibility seed verifies migrated approval and performs no mutation", async () => {
  const seed = await text(seedUrl);
  assert.match(seed, /fixtures may run only in staging/i);
  assert.match(seed, /Approved live rights records are incomplete/);
  assert.match(seed, /USGS image hosting modes are incorrect/);
  assert.match(seed, /'user_facing_entries',15/);
  assert.match(seed, /'content_items',21/);
  assert.match(seed, /'official_link_entries',6/);
  assert.doesNotMatch(seed, /\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/i);
});

test("activation changes database publication before runtime enablement and supports fail-closed disable", async () => {
  const [state, workflow] = await Promise.all([text(stateUrl), text(activationWorkflowUrl)]);
  assert.match(state, /v_ready <> 21/);
  assert.match(state, /'user_facing_entries',15/);
  assert.match(state, /r\.status='approved'/);
  assert.match(state, /l\.next_review_at > now\(\)/);
  assert.match(state, /set enabled=true/);
  assert.match(state, /set status='published'/);
  assert.match(state, /set status='unavailable'/);
  assert.match(state, /set status='draft'/);
  assert.match(workflow, /set-public-domain-live-catalogue-state\.sql/);
  assert.match(workflow, /set_database_state true[\s\S]*set-public-domain-live-sources\.sh true/);
  assert.match(workflow, /set-public-domain-live-sources\.sh false[\s\S]*set_database_state false/);
  assert.match(workflow, /Roll back failed enablement/);
  assert.match(workflow, /issues\/52/);
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

test("mobile live experience preserves official delivery, attribution and non-endorsement", async () => {
  const [watch, livePage, css] = await Promise.all([text(watchUrl), text(livePageUrl), text(cssUrl)]);
  assert.match(watch, /OfficialLiveEmbedPlayer/);
  assert.match(watch, /OfficialLiveLinkPlayer/);
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

test("staging acceptance verifies migration-installed inventory and live acceptance remains explicit", async () => {
  const [acceptance, workflow] = await Promise.all([text(acceptanceUrl), text(stagingWorkflowUrl)]);
  assert.match(acceptance, /width: 390, height: 844/);
  assert.match(acceptance, /does not sponsor or endorse Jalwa/);
  assert.match(acceptance, /x-jalwa-live-source/);
  assert.match(acceptance, /Premium/);
  assert.match(acceptance, /European Parliament Plenary/);
  assert.match(acceptance, /UN Human Rights Council/);
  assert.match(workflow, /seed-public-domain-live-sources\.sql/);
  assert.match(workflow, /public-domain-live-acceptance\.mjs/);
  assert.match(workflow, /JALWA_EXPECT_LIVE_SOURCES/);
});
