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
const manifestUrl = new URL("../../../supabase/migrations/202608010005_approved_live_catalogue_manifest.sql", import.meta.url);
const seedUrl = new URL("../../../scripts/seed-public-domain-live-sources.sql", import.meta.url);
const stateUrl = new URL("../../../scripts/set-public-domain-live-catalogue-state.sql", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/public-domain-live-acceptance.mjs", import.meta.url);
const stagingWorkflowUrl = new URL("../../../.github/workflows/staging-acceptance.yml", import.meta.url);
const activationWorkflowUrl = new URL("../../../.github/workflows/set-public-domain-live-sources.yml", import.meta.url);
const cssUrl = new URL("../app/phase9.css", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("registry preserves the original approved NASA NOAA and USGS sources", async () => {
  const registry = await text(registryUrl);
  for (const key of ["nasa-space-station-views", "noaa-ocean-camera-1", "usgs-kilauea-v1", "usgs-mauna-loa-live", "usgs-rivers-lakes-live"]) {
    assert.match(registry, new RegExp(key));
  }
  assert.match(registry, /PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED === "true"/);
  assert.doesNotMatch(registry, /\bPTV\b|\bARY\b|Geo News|\bsports\b|Tamasha|Tapmad/i);
});

test("live image delivery remains an allowlisted source-key route", async () => {
  const [security, route] = await Promise.all([text(securityUrl), text(imageRouteUrl)]);
  assert.match(security, /assertAllowedPublicHttps/);
  assert.match(security, /private or reserved address/);
  assert.match(security, /MAX_REDIRECTS = 3/);
  assert.match(security, /IMAGE_LIMIT_BYTES/);
  assert.match(security, /imagePathPattern/);
  assert.match(route, /getLiveSourceDefinition\(sourceKey\)/);
  assert.match(route, /x-jalwa-live-source/);
  assert.doesNotMatch(route, /searchParams|get\("url"\)|new URL\(request\.url\).*url/i);
});

test("schema preserves separate rights publication and runtime gates", async () => {
  const migration = await text(contractMigrationUrl);
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /next_review_at/);
  assert.match(migration, /current live-source rights review required/);
  assert.match(migration, /playback_source_health/);
});

test("initial approved inventory remains default-off and public", async () => {
  const migration = await text(approvedMigrationUrl);
  assert.match(migration, /'public_domain_live_image','self_host_open'/);
  assert.match(migration, /'official_live_embed','embed_only'/);
  assert.match(migration, /false,'content-operations'/);
  assert.match(migration, /'editorial_review'/);
});

test("manifest drives the complete controlled catalogue", async () => {
  const [manifest, seed, state] = await Promise.all([text(manifestUrl), text(seedUrl), text(stateUrl)]);
  assert.match(manifest, /v_total <> 52/);
  assert.match(manifest, /v_direct <> 44/);
  assert.match(seed, /v_manifest <> 52/);
  assert.match(seed, /v_images <> 23/);
  assert.match(seed, /v_links <> 22/);
  assert.match(seed, /'user_facing_entries',46/);
  assert.doesNotMatch(seed, /\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/i);
  assert.match(state, /approved_live_catalogue_manifest/);
  assert.match(state, /v_expected <> 52/);
  assert.match(state, /count\(\*\) \+ 2 from approved_live_state_inventory where user_facing_entry/);
});

test("activation remains transactional and fail closed", async () => {
  const [state, workflow] = await Promise.all([text(stateUrl), text(activationWorkflowUrl)]);
  assert.match(state, /r\.status='approved'/);
  assert.match(state, /l\.next_review_at > now\(\)/);
  assert.match(state, /set enabled=true/);
  assert.match(state, /set status='published'/);
  assert.match(state, /set status='unavailable'/);
  assert.match(workflow, /set_database_state true[\s\S]*set-public-domain-live-sources\.sh true/);
  assert.match(workflow, /set-public-domain-live-sources\.sh false[\s\S]*set_database_state false/);
  assert.match(workflow, /Roll back failed enablement/);
});

test("provider-aware health still handles review expiry and repeated failures", async () => {
  const health = await text(healthUrl);
  assert.match(health, /checkLiveSource/);
  assert.match(health, /reviewDue/);
  assert.match(health, /failures >= 3/);
  assert.match(health, /terms_review_due/);
  assert.match(health, /content_hash/);
});

test("mobile live experience preserves delivery and non-endorsement boundaries", async () => {
  const [watch, livePage, css] = await Promise.all([text(watchUrl), text(livePageUrl), text(cssUrl)]);
  assert.match(watch, /OfficialLiveEmbedPlayer/);
  assert.match(watch, /OfficialLiveLinkPlayer/);
  assert.match(watch, /PublicDomainLiveImagePlayer/);
  assert.match(livePage, /Official live public sources/);
  assert.match(livePage, /does not extract, restream or record/);
  assert.match(livePage, /not embedded, reproduced, cached, recorded or restreamed/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /aspect-ratio: 16\/9/);
  assert.doesNotMatch(watch, /autoplay=1/);
});

test("staging acceptance covers 46 entries and secured images", async () => {
  const [acceptance, workflow] = await Promise.all([text(acceptanceUrl), text(stagingWorkflowUrl)]);
  assert.match(acceptance, /NPS Devils Tower Entrance/);
  assert.match(acceptance, /U\.S\. Senate Floor Webcast/);
  assert.match(acceptance, /Expected at least forty-four direct live watch links/);
  assert.match(acceptance, /nps-devils-tower-entrance/);
  assert.match(workflow, /seed-public-domain-live-sources\.sql/);
  assert.match(workflow, /public-domain-live-acceptance\.mjs/);
});
