import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Use the publication validator without executing its database entrypoint.
const source = readFileSync(new URL("./publish.mjs", import.meta.url), "utf8");
const start = source.indexOf("function inspectVideo(");
const end = source.indexOf("async function decodeMedia(");
assert(start >= 0 && end > start, "Media validator boundary changed");
const inspectVideo = Function("assert", "execFileSync", "sourceAspect",
  source.slice(start, end) + "\nreturn inspectVideo;")(assert, execFileSync, 1280 / 544);

function ffmpeg(args) {
  return execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-filter_threads", "2", ...args], {
    encoding:"utf8", timeout:30000, maxBuffer:4 * 1024 * 1024,
    stdio:["ignore", "pipe", "pipe"],
  });
}

function probe(file, args) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", ...args, "-of", "json", file], {
    encoding:"utf8", timeout:30000, maxBuffer:4 * 1024 * 1024,
  }));
}

function hlsOutput(directory) {
  mkdirSync(directory);
  return ["-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments", "-hls_segment_filename",
    join(directory, "segment-%05d.ts"), join(directory, "index.m3u8")];
}

function segments(directory) {
  const playlist = readFileSync(join(directory, "index.m3u8"), "utf8");
  assert(playlist.includes("#EXT-X-ENDLIST"));
  const names = playlist.split(/\r?\n/).filter(line => /^segment-\d{5}\.ts$/.test(line));
  assert.equal(names.length, 3);
  return names.map(name => join(directory, name));
}

function firstPts(file, selector) {
  const result = probe(file, ["-select_streams", selector, "-read_intervals", "%+1",
    "-show_packets", "-show_entries", "packet=pts_time"]);
  const pts = Number(result.packets[0].pts_time);
  assert(Number.isFinite(pts));
  return pts;
}

function channelConfigurations(file) {
  const result = probe(file, ["-select_streams", "a:0", "-show_packets", "-show_data",
    "-show_entries", "packet=data"]);
  assert(result.packets.length > 0, "Expected actual AAC packets");
  const configurations = new Set();
  for (const packet of result.packets) {
    const hex = packet.data.split("\n").filter(line => line.includes(":"))
      .map(line => line.split(":", 2)[1].trimStart().split("  ", 1)[0].replaceAll(" ", "")).join("");
    const bytes = Buffer.from(hex, "hex");
    assert(bytes.length > 7 && bytes[0] === 255 && (bytes[1] & 240) === 240, "Expected ADTS frame");
    configurations.add(((bytes[2] & 1) << 2) | (bytes[3] >> 6));
  }
  return [...configurations];
}

function frameHashes(file) {
  return ffmpeg(["-threads", "2", "-i", file, "-map", "0:v:0", "-an", "-threads", "2", "-f", "framemd5", "-"])
    .split("\n").filter(line => line && !line.startsWith("#")).map(line => line.split(",").at(-1).trim());
}

test("standard AAC 5.1 preserves six channels and makes every HLS segment independently decodable", () => {
  const directory = mkdtempSync(join(tmpdir(), "jalwa-aac-configuration-"));
  try {
    const original = join(directory, "original.mkv");
    const tones = [220, 330, 440, 60, 550, 660].map(frequency => `0.03*sin(2*PI*${frequency}*t)`).join("|");
    ffmpeg([
      "-f", "lavfi", "-i", "color=c=blue:s=848x360:r=24", "-f", "lavfi", "-i",
      `aevalsrc=${tones}:channel_layout=5.1(side):sample_rate=48000`, "-t", "12",
      "-map", "0:v:0", "-map", "1:a:0", "-threads", "2", "-c:v", "libx264",
      "-preset", "veryfast", "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
      "-c:a", "ac3", "-b:a", "640k", original,
    ]);
    const originalAudio = probe(original, ["-select_streams", "a:0", "-show_entries",
      "stream=codec_name,channels,channel_layout"]).streams[0];
    assert.equal(originalAudio.codec_name, "ac3");
    assert.equal(originalAudio.channels, 6);
    assert.equal(originalAudio.channel_layout, "5.1(side)");

    const broken = join(directory, "side-layout");
    ffmpeg(["-threads", "2", "-i", original, "-map", "0:v:0", "-map", "0:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-threads", "2", ...hlsOutput(broken)]);
    const brokenSegments = segments(broken);
    for (const segment of brokenSegments) assert.deepEqual(channelConfigurations(segment), [0]);
    inspectVideo(brokenSegments[0]);
    for (const segment of brokenSegments.slice(1)) {
      assert.throws(() => inspectVideo(segment), error => Number.isInteger(error.status) && error.status !== 0 && error.signal === null);
    }

    const encoded = join(broken, "index.m3u8");
    const offset = firstPts(original, "v:0") - firstPts(encoded, "v:0");
    const fixed = join(directory, "standard-layout");
    ffmpeg(["-copyts", "-threads", "2", "-i", original, "-itsoffset", String(offset),
      "-threads", "2", "-i", encoded, "-map", "1:v:0", "-map", "0:a:0",
      "-c:v", "copy", "-c:a", "aac", "-channel_layout:a", "5.1", "-b:a", "128k",
      "-threads", "2", ...hlsOutput(fixed)]);
    for (const segment of segments(fixed)) {
      assert.deepEqual(channelConfigurations(segment), [6]);
      const audio = probe(segment, ["-select_streams", "a:0", "-show_entries",
        "stream=codec_name,channels,channel_layout,sample_rate"]).streams[0];
      assert.equal(audio.codec_name, "aac");
      assert.equal(audio.channels, 6);
      assert.equal(audio.channel_layout, "5.1");
      assert.equal(audio.sample_rate, "48000");
      inspectVideo(segment);
    }
    const fixedPlaylist = join(fixed, "index.m3u8");
    inspectVideo(fixedPlaylist, 12);
    const originalFrames = frameHashes(original);
    assert.equal(originalFrames.length, 288);
    assert.deepEqual(frameHashes(fixedPlaylist), originalFrames, "Video frames changed during audio repair");
    const originalSync = firstPts(original, "v:0") - firstPts(original, "a:0");
    const fixedSync = firstPts(fixedPlaylist, "v:0") - firstPts(fixedPlaylist, "a:0");
    assert(Math.abs(fixedSync - originalSync - 1024 / 48000) < 0.001, "A/V sync changed beyond AAC priming");
  } finally {
    rmSync(directory, {recursive:true, force:true});
  }
});
