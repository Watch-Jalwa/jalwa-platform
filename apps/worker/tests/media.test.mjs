import test from "node:test";
import assert from "node:assert/strict";
import { buildHlsArgs, buildShortArgs } from "../src/media.mjs";

test("short transcode uses faststart, portrait canvas and local protocols", () => {
  const args = buildShortArgs("input", "output");
  assert.ok(args.includes("+faststart"));
  assert.ok(args.some((value) => value.includes("720:1280")));
  assert.ok(args.includes("-nostdin"));
  assert.ok(args.includes("-protocol_whitelist"));
  assert.ok(args.includes("file,pipe,crypto,data"));
});

test("HLS transcode creates a master playlist and three variants", () => {
  const args = buildHlsArgs("input", "/tmp/output");
  assert.ok(args.includes("master.m3u8"));
  assert.ok(args.some((value) => value.includes("360p")));
  assert.ok(args.some((value) => value.includes("720p")));
  assert.ok(args.includes("independent_segments"));
});
