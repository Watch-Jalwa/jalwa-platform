import assert from "node:assert/strict";
import test from "node:test";
import {
  canPlayVideoContent,
  FREE_UNLOCKED_VIDEO_LIMIT,
  summarizeVideoAccess,
} from "../lib/catalogue/free-tier-access-core.mjs";
import { lockedContentBadge, lockedContentHref, lockedContentPrimaryLabel } from "../lib/catalogue/locked-content-cta.mjs";
import { TEMPORARILY_HIDDEN_CONTENT_SLUGS, isTemporarilyHiddenSlug } from "../lib/catalogue/temporarily-hidden-slugs.mjs";
import { readFile } from "node:fs/promises";

test("free unlocked video limit is 10", () => {
  assert.equal(FREE_UNLOCKED_VIDEO_LIMIT, 10);
});

test("free unlocked catalogue query stays capped at 10 featured/newest videos", async () => {
  const source = await readFile(new URL("../lib/catalogue/free-tier-access.mjs", import.meta.url), "utf8");
  assert.match(source, /FREE_UNLOCKED_VIDEO_LIMIT/);
  assert.match(source, /is_featured desc/);
  assert.match(source, /limit \$1/);
  assert.match(source, /TEMPORARILY_HIDDEN_CONTENT_SLUGS/);
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
  assert.match(source, /lockedContentBadge/);
  assert.match(source, /lockedContentHref/);
  assert.doesNotMatch(source, /free-tier-access-core\.mjs/);
});

test("shorts feed does not embed locked YouTube outside the free 10", async () => {
  const source = await readFile(new URL("../components/shorts-feed.tsx", import.meta.url), "utf8");
  assert.match(source, /lockedForViewer === false/);
  assert.match(source, /lockedContentHref/);
  assert.match(source, /Free accounts can watch 10 videos/);
});

test("recommendation rail sends locked videos to login or pricing by session", async () => {
  const source = await readFile(new URL("../components/recommendation-rail.tsx", import.meta.url), "utf8");
  assert.match(source, /lockedForViewer !== false/);
  assert.match(source, /lockedContentHref/);
  assert.match(source, /lockedContentBadge/);
});

test("locked content CTA routes guests to sign-in and members to pricing", () => {
  assert.equal(lockedContentHref("demo-slug", false), "/login?next=%2Fwatch%2Fdemo-slug");
  assert.equal(lockedContentHref("demo-slug", true), "/pricing?next=%2Fwatch%2Fdemo-slug");
  assert.equal(lockedContentBadge(false), "Sign in");
  assert.equal(lockedContentBadge(true), "Premium");
  assert.equal(lockedContentPrimaryLabel(false), "Sign in");
  assert.equal(lockedContentPrimaryLabel(true), "View Premium");
});

test("client-requested titles stay on the temporary hide list", () => {
  assert.equal(TEMPORARILY_HIDDEN_CONTENT_SLUGS.length, 4);
  assert.equal(isTemporarilyHiddenSlug("nasa-space-station-views"), true);
  assert.equal(isTemporarilyHiddenSlug("abrasive-bird-debate-cc0"), true);
  assert.equal(isTemporarilyHiddenSlug("house-sparrow-tschilp-cc0"), true);
  assert.equal(isTemporarilyHiddenSlug("huamei-bird-calling-cc0"), true);
  assert.equal(isTemporarilyHiddenSlug("big-buck-bunny"), false);
});

test("site header no longer shows the notification dot", async () => {
  const source = await readFile(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /notification-link/);
  assert.doesNotMatch(source, /\/notifications/);
});

test("watch page redirects signed-in locked viewers to pricing", async () => {
  const source = await readFile(new URL("../app/watch/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /redirect\(lockedContentHref\(item\.slug, true\)\)/);
  assert.match(source, /Sign in/);
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
