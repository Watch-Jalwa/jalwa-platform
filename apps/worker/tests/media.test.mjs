import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAudioArgs, buildHlsArgs, buildShortArgs, buildThumbnailArgs, probeMedia } from "../src/media.mjs";

test("short transcode preserves source aspect instead of burning portrait black bars", () => {
  const args = buildShortArgs("input", "output");
  const filter = args[args.indexOf("-vf") + 1];
  assert.ok(args.includes("+faststart"));
  assert.match(filter, /force_original_aspect_ratio=decrease/);
  assert.match(filter, /force_divisible_by=2/);
  assert.match(filter, /min\(iw,1280\)/);
  assert.match(filter, /min\(ih,1280\)/);
  assert.doesNotMatch(filter, /\bpad=/);
  assert.ok(args.includes("-nostdin"));
  assert.ok(args.includes("-protocol_whitelist"));
  assert.ok(args.includes("file,pipe,crypto,data"));
});

test("thumbnail generation emits one bounded JPEG frame", () => {
  const args = buildThumbnailArgs("input", "thumbnail.jpg");
  assert.ok(args.includes("-frames:v"));
  assert.ok(args.some((value) => value.includes("thumbnail=30")));
  assert.ok(args.some((value) => value.includes("scale=640")));
  assert.equal(args.at(-1), "thumbnail.jpg");
});

test("HLS transcode creates a master playlist and three variants", () => {
  const args = buildHlsArgs("input", "/tmp/output");
  assert.ok(args.includes("master.m3u8"));
  assert.ok(args.some((value) => value.includes("360p")));
  assert.ok(args.some((value) => value.includes("720p")));
  assert.ok(args.includes("independent_segments"));
  assert.ok(args.includes("v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p"));
});

test("HLS transcode supports video with no audio stream", () => {
  const args = buildHlsArgs("input", "/tmp/output", false);
  assert.ok(args.includes("v:0,name:360p v:1,name:480p v:2,name:720p"));
  assert.equal(args.filter((value) => value === "0:a?").length, 0);
});

const ffmpegAvailable = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0
  && spawnSync("ffprobe", ["-version"], { stdio: "ignore" }).status === 0;

test("short transcode outputs preserve landscape, portrait and archival proportions", { skip: !ffmpegAvailable }, () => {
  const directory = mkdtempSync(join(tmpdir(), "jalwa-video-aspect-"));
  try {
    for (const [width, height, expectedWidth, expectedHeight] of [
      [1280, 720, 1280, 720],
      [720, 1280, 720, 1280],
      [640, 480, 640, 480],
      [854, 480, 854, 480],
      [1920, 1080, 1280, 720],
    ]) {
      const input = join(directory, `source-${width}x${height}.mp4`);
      const output = join(directory, `short-${width}x${height}.mp4`);
      const generated = spawnSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=1`,
        "-frames:v", "2", "-c:v", "mpeg4", input,
      ], { encoding: "utf8", timeout: 30_000 });
      assert.equal(generated.status, 0, `Fixture ${width}x${height}: ${generated.stderr}`);
      const encoded = spawnSync("ffmpeg", buildShortArgs(input, output), { encoding: "utf8", timeout: 40_000 });
      assert.equal(encoded.status, 0, `Encoded ${width}x${height}: ${encoded.stderr}`);
      const probed = spawnSync("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", output,
      ], { encoding: "utf8", timeout: 15_000 });
      assert.equal(probed.status, 0, `Probed ${width}x${height}: ${probed.stderr}`);
      const stream = JSON.parse(probed.stdout).streams[0];
      assert.deepEqual([stream.width, stream.height], [expectedWidth, expectedHeight],
        `Incorrect output orientation for ${width}x${height}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});


test("audio-only OGG source probes and transcodes into playable AAC without fake video", { skip: !ffmpegAvailable }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "jalwa-audio-only-"));
  try {
    const original = join(directory, "bird-call.oga");
    const encoded = join(directory, "bird-call.m4a");
    const source = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "sine=frequency=640:duration=1",
      "-c:a", "libvorbis", original,
    ], { encoding: "utf8", timeout: 30_000 });
    assert.equal(source.status, 0, source.stderr);
    await assert.rejects(probeMedia(original), /no video stream/);
    const probed = await probeMedia(original, true);
    assert.equal(probed.streamCount, 1);
    const command = buildAudioArgs(original, encoded);
    assert.ok(command.includes("0:a:0"));
    assert.ok(command.includes("-vn"));
    assert.ok(command.includes("aac"));
    const result = spawnSync("ffmpeg", command, { encoding: "utf8", timeout: 40_000 });
    assert.equal(result.status, 0, result.stderr);
    const inspect = spawnSync("ffprobe", [
      "-v", "error", "-show_entries", "stream=codec_type,codec_name:format=duration",
      "-of", "json", encoded,
    ], { encoding: "utf8", timeout: 15_000 });
    assert.equal(inspect.status, 0, inspect.stderr);
    const decoded = JSON.parse(inspect.stdout);
    assert.ok(decoded.streams.some((stream) => stream.codec_type === "audio" && stream.codec_name === "aac"));
    assert.equal(decoded.streams.some((stream) => stream.codec_type === "video"), false);
    assert.ok(Number(decoded.format.duration) >= 0.9);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
