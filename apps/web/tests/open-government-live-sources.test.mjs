import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourcesUrl = new URL("../lib/live-sources/open-government-sources.js", import.meta.url);
const securityUrl = new URL("../lib/live-sources/security.ts", import.meta.url);
const migrationUrl = new URL("../../../database/migrations/202608010004_open_government_live_expansion.sql", import.meta.url);
const manifestUrl = new URL("../../../database/migrations/202608010005_approved_live_catalogue_manifest.sql", import.meta.url);
const stateUrl = new URL("../../../scripts/set-public-domain-live-catalogue-state.sql", import.meta.url);
const seedUrl = new URL("../../../scripts/seed-public-domain-live-sources.sql", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/public-domain-live-acceptance.mjs", import.meta.url);
const launchRefreshUrl = new URL("../../../database/migrations/202609290001_live_catalogue_upstream_refresh.sql", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("open-government registry installs thirty-one source definitions", async () => {
  const sources = await text(sourcesUrl);
  const keys = [
    "dvids-live-webcasts", "nasa-plus-live-events", "nps-devils-tower-entrance", "nps-el-morro",
    "nih-videocast", "fda-advisory-committee-live", "sec-public-meetings", "fcc-open-meetings",
    "europe-by-satellite-ebs", "europe-by-satellite-ebs-plus", "us-house-floorcast", "us-senate-floor-webcast",
  ];
  for (const key of keys) assert.match(sources, new RegExp(key));
  assert.match(sources, /npsRows\.map\(npsSource\)/);
  assert.match(sources, /linkRows\.map\(officialLink\)/);
  assert.match(sources, /Object\.assign\(LIVE_SOURCE_REGISTRY, OPEN_GOVERNMENT_LIVE_SOURCES\)/);
  assert.doesNotMatch(sources, /Al Jazeera|PTV|Doordarshan|DD News|ARY|Geo News/i);
});

test("NPS launch delivery uses verified direct images and conservative official-link fallbacks", async () => {
  const [sources, security, launchRefresh] = await Promise.all([text(sourcesUrl), text(securityUrl), text(launchRefreshUrl)]);
  for (const marker of [
    "https://www.nps.gov/webcams-deto/deto5.jpg",
    "https://www.nps.gov/webcams-mora/SunriseMtn.jpg",
    "https://www.nps.gov/webcams-mora/mountain.jpg",
    "https://www.nps.gov/featurecontent/ard/webcams/images/gsnglarge.jpg",
    "https://www.nps.gov/webcams-bost/sw-ts.jpeg",
  ]) assert.ok(sources.includes(marker), "missing launch NPS image: " + marker);
  for (const fallback of [
    "nps-guadalupe-pine-springs", "nps-shenandoah-mountain-view", "nps-shenandoah-big-meadows",
    "nps-glacier-night-sky", "nps-painted-desert-inn", "nps-el-morro",
  ]) assert.ok(launchRefresh.includes(fallback), "missing NPS official-link fallback: " + fallback);
  assert.match(sources, /allowedHosts: HOSTS\.nps/);
  assert.match(security, /assertAllowedPublicHttps/);
  assert.doesNotMatch(sources, /phenocam\.nau\.edu/);
  assert.doesNotMatch(sources, /192\.1681\.1\.197/);
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
  assert.match(seed, /'current_image_entries',16/);
  assert.match(seed, /'official_link_entries',29/);
  assert.match(acceptance, /expectedTitles/);
  assert.match(acceptance, /officialLinkSlugs/);
  assert.match(acceptance, /NPS Devils Tower Entrance/);
});


test("launch refresh narrows seven unsafe live images to official-link delivery", async () => {
  const migration = await text(launchRefreshUrl);
  assert.match(migration, /v_fallbacks <> 7/);
  assert.match(migration, /v_images <> 16/);
  assert.match(migration, /v_links <> 29/);
  assert.match(migration, /v_embeds <> 7/);
  assert.match(migration, /set self_hosting_confirmed=false/);
  assert.match(migration, /delivery_adapter='official_live_link'/);
  assert.doesNotMatch(migration, /set enabled=true/);
});
