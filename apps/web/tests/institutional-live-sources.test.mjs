import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryUrl = new URL("../lib/live-sources/registry.ts", import.meta.url);
const securityUrl = new URL("../lib/live-sources/security.ts", import.meta.url);
const linkPlayerUrl = new URL("../components/official-live-link-player.tsx", import.meta.url);
const watchUrl = new URL("../app/watch/[slug]/page.tsx", import.meta.url);
const livePageUrl = new URL("../app/live/page.tsx", import.meta.url);
const migrationUrl = new URL("../../../supabase/migrations/202608010003_institutional_public_affairs_live_sources.sql", import.meta.url);
const stateUrl = new URL("../../../scripts/set-public-domain-live-catalogue-state.sql", import.meta.url);
const acceptanceUrl = new URL("../../../scripts/public-domain-live-acceptance.mjs", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

const keys = ["european-parliament-plenary", "european-parliament-committee-rooms", "un-web-tv", "un-general-assembly", "un-security-council", "un-human-rights-council"];

test("registry preserves six official institutional link sources", async () => {
  const registry = await text(registryUrl);
  for (const key of keys) assert.match(registry, new RegExp(`"${key}"`));
  assert.match(registry, /official_live_link/);
  assert.match(registry, /webtv\.un\.org\/en\/copyright_use/);
  assert.doesNotMatch(registry, /un-(?:web-tv|general-assembly|security-council|human-rights-council)[\s\S]{0,900}embedVideoId/);
});

test("link-only player never creates an iframe", async () => {
  const [player, watch] = await Promise.all([text(linkPlayerUrl), text(watchUrl)]);
  assert.match(player, /Open official live coverage/);
  assert.match(player, /does not reproduce, restream or record/);
  assert.doesNotMatch(player, /<iframe/);
  assert.match(watch, /OfficialLiveLinkPlayer/);
  assert.match(watch, /official_live_link/);
});

test("health monitoring validates allowlisted official pages", async () => {
  const security = await text(securityUrl);
  assert.match(security, /checkOfficialLink/);
  assert.match(security, /fetchAllowed\(definition\.officialSourceUrl, definition, "HEAD"\)/);
  assert.match(security, /fetchAllowed\(definition\.officialSourceUrl, definition, "GET"\)/);
  assert.match(security, /readBounded\(get\.response, HTML_LIMIT_BYTES\)/);
});

test("migration records link-only rights and blocks UN inline use", async () => {
  const migration = await text(migrationUrl);
  assert.match(migration, /add value if not exists 'european_parliament'/);
  assert.match(migration, /add value if not exists 'un_web_tv'/);
  assert.match(migration, /add value if not exists 'official_live_link'/);
  assert.match(migration, /UNITED_NATIONS_OFFICIAL_LINK_ONLY/);
  assert.match(migration, /UN footage is not public domain/);
  assert.match(migration, /embedding_confirmed=false/);
  assert.match(migration, /v_links <> 6/);
});

test("institutional entries remain in the 46-entry controlled release", async () => {
  const [state, acceptance, livePage] = await Promise.all([text(stateUrl), text(acceptanceUrl), text(livePageUrl)]);
  assert.match(state, /v_expected <> 52/);
  assert.match(state, /count\(\*\) \+ 2 from approved_live_state_inventory where user_facing_entry/);
  assert.match(acceptance, /European Parliament Plenary/);
  assert.match(acceptance, /UN Human Rights Council/);
  assert.match(acceptance, /forty-four direct live watch links/);
  assert.match(livePage, /government · public affairs/);
  assert.match(livePage, /not embedded, reproduced, cached, recorded or restreamed/);
});
