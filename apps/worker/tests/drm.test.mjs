import assert from "node:assert/strict";
import test from "node:test";
import { buildAudioArgs, buildPackagerArgs, buildVideoArgs } from "../src/drm.mjs";

test("DRM renditions use fixed GOPs and remove audio from video tracks", () => {
  const args = buildVideoArgs("input.mp4","720.mp4",720);
  assert.ok(args.includes("-an"));
  assert.ok(args.includes("-g"));
  assert.ok(args.includes("144"));
});

test("audio packaging maps an explicit audio stream", () => {
  const args = buildAudioArgs("input.mp4","audio.mp4");
  assert.ok(args.includes("0:a:0"));
  assert.ok(args.includes("128k"));
});

test("Shaka packaging creates encrypted HLS and DASH without offline sessions", () => {
  const args = buildPackagerArgs({ inputDir: "/in", outputDir: "/out", keyId: "00112233445566778899aabbccddeeff", key: "ffeeddccbbaa99887766554433221100", hasAudio: true });
  assert.ok(args.includes("--enable_raw_key_encryption"));
  assert.ok(args.includes("--protection_scheme"));
  assert.ok(args.includes("cbcs"));
  assert.ok(args.includes("--hls_master_playlist_output"));
  assert.ok(args.includes("--mpd_output"));
  assert.ok(args.some((value) => value.includes("drm_label=AUDIO")));
});

test("silent sources do not reference a missing audio input", () => {
  const args = buildPackagerArgs({ inputDir: "/in", outputDir: "/out", keyId: "00112233445566778899aabbccddeeff", key: "ffeeddccbbaa99887766554433221100", hasAudio: false });
  assert.ok(!args.some((value) => value.includes("audio.mp4")));
  assert.ok(!args.some((value) => value.includes("label=AUDIO")));
});
