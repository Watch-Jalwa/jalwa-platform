import assert from "node:assert/strict";
import test from "node:test";
import { canPlayVideoContent, FREE_UNLOCKED_VIDEO_LIMIT } from "../lib/catalogue/free-tier-access-core.mjs";

test("free unlocked video limit is 10", () => {
  assert.equal(FREE_UNLOCKED_VIDEO_LIMIT, 10);
});

test("premium signed-in viewers can play any video", () => {
  const access = { signedIn: true, premium: true, freeUnlockedIds: new Set(["a"]) };
  assert.equal(canPlayVideoContent(access, { contentId: "z", contentType: "video" }), true);
  assert.equal(canPlayVideoContent(access, { contentId: "z", contentType: "short" }), true);
});

test("guests and free viewers only play free unlocked videos", () => {
  const access = { signedIn: false, premium: false, freeUnlockedIds: new Set(["free-1", "free-2"]) };
  assert.equal(canPlayVideoContent(access, { contentId: "free-1", contentType: "video" }), true);
  assert.equal(canPlayVideoContent(access, { contentId: "locked", contentType: "video" }), false);
  assert.equal(canPlayVideoContent(access, { contentId: "locked", contentType: "short" }), false);
});

test("signed-in without premium stays on free unlocked set", () => {
  const access = { signedIn: true, premium: false, freeUnlockedIds: new Set(["free-1"]) };
  assert.equal(canPlayVideoContent(access, { contentId: "free-1", contentType: "video" }), true);
  assert.equal(canPlayVideoContent(access, { contentId: "locked", contentType: "video" }), false);
});

test("non-video catalogue types are not gated by the free video limit", () => {
  const access = { signedIn: false, premium: false, freeUnlockedIds: new Set() };
  assert.equal(canPlayVideoContent(access, { contentId: "live-1", contentType: "live" }), true);
  assert.equal(canPlayVideoContent(access, { contentId: "article-1", contentType: "article" }), true);
});
