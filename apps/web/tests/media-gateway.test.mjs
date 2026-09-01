import test from "node:test";
import assert from "node:assert/strict";
import { mediaPathAllowed, normalizeMediaPath, rewriteHlsPlaylist } from "../lib/media/gateway.mjs";

test("media paths are confined to processed objects", () => {
  assert.equal(normalizeMediaPath(["processed", "content", "asset", "master.m3u8"]), "processed/content/asset/master.m3u8");
  assert.equal(normalizeMediaPath(["processed", "..", "secret"]), null);
  assert.equal(normalizeMediaPath(["incoming", "secret.mp4"]), null);
  assert.equal(mediaPathAllowed("processed/content/asset/720p/index.m3u8", "processed/content/asset/"), true);
  assert.equal(mediaPathAllowed("processed/content/other/index.m3u8", "processed/content/asset/"), false);
});

test("HLS playlist rewrite keeps playback token on relative children", () => {
  const source = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\n720p/index.m3u8\n#EXT-X-MAP:URI=\"init.mp4\"\nsegment-00001.ts\n";
  const output = rewriteHlsPlaylist(source, "abc.def");
  assert.match(output, /720p\/index\.m3u8\?token=abc\.def/);
  assert.match(output, /URI="init\.mp4\?token=abc\.def"/);
  assert.match(output, /segment-00001\.ts\?token=abc\.def/);
});

test("HLS rewrite refuses absolute child origins", () => {
  assert.throws(() => rewriteHlsPlaylist("#EXTM3U\nhttps://example.com/segment.ts", "token"), /non-relative/);
});
