import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../../../supabase/migrations/202607300007_customer_journeys.sql", import.meta.url), "utf8");
const provider = await readFile(new URL("../lib/payments/provider.ts", import.meta.url), "utf8");
const watchPage = await readFile(new URL("../app/watch/[slug]/page.tsx", import.meta.url), "utf8");

test("customer migration includes protected viewer profiles and watch history", () => {
  assert.match(migration, /create table public\.viewer_profiles/);
  assert.match(migration, /create table public\.watch_progress/);
  assert.match(migration, /viewer profiles own read/);
  assert.match(migration, /upsert_watch_progress/);
});

test("payment providers are isolated behind signed hosted adapters", () => {
  assert.match(provider, /createHmac\("sha256"/);
  assert.match(provider, /JAZZCASH_CHECKOUT_URL/);
  assert.match(provider, /EASYPAISA_CHECKOUT_URL/);
  assert.match(provider, /PAYFAST_CHECKOUT_URL/);
});

test("watch page uses resilient embeds instead of a raw iframe", () => {
  assert.match(watchPage, /ResilientYouTubePlayer/);
  assert.doesNotMatch(watchPage, /<iframe/);
});
