import test from "node:test";
import assert from "node:assert/strict";
import { buildHlsArgs, buildShortArgs } from "../src/media.mjs";

test("short transcode uses faststart and portrait canvas", () => { const args = buildShortArgs("input", "output"); assert.ok(args.includes("+faststart")); assert.ok(args.some((value) => value.includes("720:1280"))); });
test("HLS transcode creates a master playlist and three variants", () => { const args = buildHlsArgs("input", "/tmp/output"); assert.ok(args.includes("master.m3u8")); assert.ok(args.some((value) => value.includes("360p"))); assert.ok(args.some((value) => value.includes("720p"))); });
