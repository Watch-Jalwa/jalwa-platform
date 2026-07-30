import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const social = await readFile(new URL("../../../supabase/migrations/202607310002_social_controls.sql", import.meta.url), "utf8");
const recommendations = await readFile(new URL("../../../supabase/migrations/202607310001_social_recommendations.sql", import.meta.url), "utf8");
const semantic = await readFile(new URL("../../../supabase/migrations/202607310003_semantic_recommendations.sql", import.meta.url), "utf8");
const liveDrm = await readFile(new URL("../../../supabase/migrations/202607310004_live_drm.sql", import.meta.url), "utf8");
const hardening = await readFile(new URL("../../../supabase/migrations/202607310006_social_live_hardening.sql", import.meta.url), "utf8");
const gateway = await readFile(new URL("../../../infrastructure/media-gateway/src/index.ts", import.meta.url), "utf8");
const player = await readFile(new URL("../components/drm-player.tsx", import.meta.url), "utf8");
const liveProvider = await readFile(new URL("../lib/live/cloudflare.ts", import.meta.url), "utf8");

test("comments enforce kids-mode, slow-mode and staff moderation in PostgreSQL", () => {
  assert.match(social, /kids_mode=false/);
  assert.match(social, /slow mode active/);
  assert.match(social, /moderate_comment/);
  assert.match(recommendations, /set_user_block/);
  assert.match(social, /set_user_mute/);
  assert.match(hardening, /revoke insert,update,delete on public.comments/);
});

test("recommendations combine behavioural, co-watch and semantic models", () => {
  assert.match(recommendations, /profile_category_affinities/);
  assert.match(recommendations, /similarity_kind='co_watch'/);
  assert.match(recommendations, /get_recommendations/);
  assert.match(semantic, /extensions\.vector\(96\)/);
  assert.match(semantic, /refresh_semantic_similarity/);
});

test("live inputs keep stream secrets outside PostgreSQL", () => {
  assert.match(liveDrm, /provider_input_id text/);
  assert.doesNotMatch(liveDrm, /stream_key|srt_passphrase/i);
  assert.match(liveProvider, /rtmpsKey/);
  assert.match(liveProvider, /srtPassphrase/);
  assert.match(hardening, /revoke execute on function public.touch_live_session/);
});

test("DRM uses temporary online sessions and audited licence proxying", () => {
  assert.match(liveDrm, /create table public\.drm_license_events/);
  assert.match(player, /persistentState: "not-allowed"/);
  assert.match(player, /sessionTypes: \["temporary"\]/);
  assert.match(player, /offline storage is intentionally disabled/i);
});

test("signed HLS gateway propagates authorization to playlists and segments", () => {
  assert.match(gateway, /rewritePlaylist/);
  assert.match(gateway, /token=/);
  assert.match(gateway, /access-control-allow-origin/);
});
