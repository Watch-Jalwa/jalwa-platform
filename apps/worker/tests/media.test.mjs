import test from "node:test";
import assert from "node:assert/strict";
import { buildHlsArgs, buildShortArgs, buildThumbnailArgs } from "../src/media.mjs";

test("short transcode uses faststart, portrait canvas and local protocols", () => {
  const args = buildShortArgs("input", "output");
  assert.ok(args.includes("+faststart"));
  assert.ok(args.some((value) => value.includes("720:1280")));
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
