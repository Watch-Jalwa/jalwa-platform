import assert from "node:assert/strict";
import test from "node:test";
import {
  canPlayVideoContent,
  FREE_UNLOCKED_VIDEO_LIMIT,
  summarizeVideoAccess,
} from "../lib/catalogue/free-tier-access-core.mjs";
import { readFile } from "node:fs/promises";

test("free unlocked video limit is 10", () => {
  assert.equal(FREE_UNLOCKED_VIDEO_LIMIT, 10);
});

test("free unlocked catalogue query stays capped at 10 featured/newest videos", async () => {
  const source = await readFile(new URL("../lib/catalogue/free-tier-access.mjs", import.meta.url), "utf8");
  assert.match(source, /FREE_UNLOCKED_VIDEO_LIMIT/);
  assert.match(source, /is_featured desc/);
  assert.match(source, /limit \$1/);
});

test("summarizeVideoAccess counts free vs premium-locked videos", () => {
  const summary = summarizeVideoAccess([
    { contentType: "video", lockedForViewer: false },
    { contentType: "video", lockedForViewer: false },
    { contentType: "short", lockedForViewer: true },
    { contentType: "article", lockedForViewer: false },
  ]);
  assert.equal(summary.totalVideos, 3);
  assert.equal(summary.freeUnlocked, 2);
  assert.equal(summary.lockedForPremium, 1);
  assert.equal(summary.freeLimit, 10);
});

test("content cards only badge Free on gated videos, not live streams", async () => {
  const source = await readFile(new URL("../components/content-card.tsx", import.meta.url), "utf8");
  assert.match(source, /isGatedVideoType/);
  assert.match(source, /lockedForViewer !== false/);
  assert.match(source, /"Live"/);
  assert.match(source, /"Premium"/);
  assert.doesNotMatch(source, /free-tier-access-core\.mjs/);
});

test("shorts feed does not embed locked YouTube outside the free 10", async () => {
  const source = await readFile(new URL("../components/shorts-feed.tsx", import.meta.url), "utf8");
  assert.match(source, /lockedForViewer === false/);
  assert.match(source, /View Premium/);
  assert.match(source, /Free accounts can watch 10 videos/);
});

test("recommendation rail sends locked videos to pricing", async () => {
  const source = await readFile(new URL("../components/recommendation-rail.tsx", import.meta.url), "utf8");
  assert.match(source, /lockedForViewer !== false/);
  assert.match(source, /\/pricing\?next=/);
  assert.match(source, /"Premium"/);
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
