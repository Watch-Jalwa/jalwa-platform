import test from "node:test";
import assert from "node:assert/strict";
import { safeMediaExtension, selectPipeline, validateMediaUpload } from "../lib/media/policy.mjs";
import { signPlaybackToken, verifyPlaybackToken } from "../lib/media/token.mjs";

test("short content selects MP4 pipeline", () => { assert.equal(selectPipeline({ contentType: "short" }), "short_mp4"); assert.equal(selectPipeline({ contentType: "video", durationSeconds: 60 }), "short_mp4"); assert.equal(selectPipeline({ contentType: "video", durationSeconds: 600 }), "hls"); });
test("upload policy rejects unknown media", () => { assert.equal(validateMediaUpload({ mimeType: "application/pdf", sizeBytes: 100 }).ok, false); assert.equal(validateMediaUpload({ mimeType: "video/mp4", sizeBytes: 100 }).ok, true); assert.equal(safeMediaExtension("clip.MP4"), "mp4"); });
test("playback tokens are signed and expire", () => { const token = signPlaybackToken({ assetId: "asset", pathPrefix: "processed/" }, "secret", 60); assert.equal(verifyPlaybackToken(token, "secret", Math.floor(Date.now() / 1000))?.assetId, "asset"); assert.equal(verifyPlaybackToken(token, "wrong"), null); assert.equal(verifyPlaybackToken(token, "secret", Math.floor(Date.now() / 1000) + 61), null); });
