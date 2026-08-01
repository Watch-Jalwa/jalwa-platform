import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourcesUrl = new URL("../lib/live-sources/open-government-sources.js", import.meta.url);
const securityUrl = new URL("../lib/live-sources/security.ts", import.meta.url);
const migrationUrl = new URL("../../../supabase/migrations/202608010004_open_government_live_expansion.sql", import.meta.url);
const manifestUrl = new URL("../../../supabase/migrations/202608010005_approved_live_catalogue_manifest.sql", import.meta.url);
const stateUrl = new URL("../../../scripts/set-public-domain-live-catalogue-state.sql", import.meta.url);
const seedUrl = new URL("../../../scripts/seed-public-domain-live-sources.sql", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/public-domain-live-acceptance.mjs", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("open-government registry installs thirty-one source definitions", async () => {
  const sources = await text(sourcesUrl);
  const keys = [
    "dvids-live-webcasts", "nasa-plus-live-events", "nps-devils-tower-entrance", "nps-el-morro",
    "nih-videocast", "fda-advisory-committee-live", "sec-public-meetings", "fcc-open-meetings",
    "europe-by-satellite-ebs", "europe-by-satellite-ebs-plus", "us-house-floorcast", "us-senate-floor-webcast",
  ];
  for (const key of keys) assert.match(sources, new RegExp(key));
  assert.match(sources, /npsRows\.map\(npsCamera\)/);
  assert.match(sources, /linkRows\.map\(officialLink\)/);
  assert.match(sources, /Object\.assign\(LIVE_SOURCE_REGISTRY, OPEN_GOVERNMENT_LIVE_SOURCES\)/);
  assert.doesNotMatch(sources, /Al Jazeera|PTV|Doordarshan|DD News|ARY|Geo News/i);
});

test("NPS current-image discovery is restricted to official webcam paths", async () => {
  const [sources, security] = await Promise.all([text(sourcesUrl), text(securityUrl)]);
  assert.match(sources, /imagePathPattern: "\^\/webcams-/);
  assert.match(sources, /allowedHosts: HOSTS\.nps/);
  assert.match(security, /new RegExp\(definition\.imagePathPattern/);
  assert.match(security, /pathPattern\.test\(allowed\.pathname\)/);
  assert.match(security, /assertAllowedPublicHttps/);
});

test("Tier A and Tier B video sources remain official-link only", async () => {
  const [sources, migration] = await Promise.all([text(sourcesUrl), text(migrationUrl)]);
  assert.match(sources, /adapter: "official_live_link"/);
  assert.doesNotMatch(sources, /embedVideoId|iframeIndex/);
  assert.match(migration, /v_links <> 16/);
  assert.match(migration, /embedding_confirmed=false/);
  assert.match(migration, /self_hosting_confirmed=i\.self_hosting_confirmed/);
  assert.match(migration, /US_HOUSE_OFFICIAL_LINK_AD_FREE/);
  assert.match(migration, /EU_CC_BY_4_OFFICIAL_LINK/);
});

test("deployment installs thirty-one additions disabled and unpublished", async () => {
  const migration = await text(migrationUrl);
  assert.match(migration, /'editorial_review'/);
  assert.match(migration, /enabled=false/);
  assert.match(migration, /v_items <> 31/);
  assert.match(migration, /v_configs <> 31/);
  assert.match(migration, /v_rights <> 31/);
  assert.match(migration, /v_images <> 15/);
  assert.doesNotMatch(migration, /set status='published'/);
});

test("manifest and activation represent 46 user-facing entries", async () => {
  const [manifest, state, seed, acceptance] = await Promise.all([text(manifestUrl), text(stateUrl), text(seedUrl), text(acceptanceUrl)]);
  assert.match(manifest, /v_total <> 52/);
  assert.match(manifest, /v_direct <> 44/);
  assert.match(state, /approved_live_catalogue_manifest/);
  assert.match(seed, /'user_facing_entries',46/);
  assert.match(seed, /'current_image_entries',23/);
  assert.match(seed, /'official_link_entries',22/);
  assert.match(acceptance, /expectedTitles/);
  assert.match(acceptance, /officialLinkSlugs/);
  assert.match(acceptance, /NPS Devils Tower Entrance/);
});
