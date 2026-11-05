import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cataloguePosterPath,
  withCataloguePosterFallback,
  youtubePosterUrl,
} from "../lib/catalogue/poster-core.mjs";

test("youtube poster URLs use hqdefault art", () => {
  assert.equal(youtubePosterUrl("dQw4w9WgXcQ"), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(youtubePosterUrl("../bad"), null);
});

test("catalogue poster path is stable per content id", () => {
  const id = "a2de188e-f7aa-4c28-8c06-e487c9a75a69";
  assert.equal(cataloguePosterPath(id), `/api/catalogue/poster/${id}`);
  assert.equal(cataloguePosterPath("nope"), null);
});

test("poster fallback fills missing video thumbnails only", () => {
  const id = "a2de188e-f7aa-4c28-8c06-e487c9a75a69";
  assert.equal(
    withCataloguePosterFallback({ id, contentType: "video", thumbnailUrl: null }).thumbnailUrl,
    `/api/catalogue/poster/${id}`,
  );
  assert.equal(
    withCataloguePosterFallback({ id, contentType: "video", thumbnailUrl: "https://cdn.example/a.jpg" }).thumbnailUrl,
    "https://cdn.example/a.jpg",
  );
  assert.equal(
    withCataloguePosterFallback({ id, contentType: "live", thumbnailUrl: null }).thumbnailUrl,
    null,
  );
});

test("poster route and worker persist catalogue posters", async () => {
  const route = await readFile(new URL("../app/api/catalogue/poster/[contentId]/route.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../../../apps/worker/src/media.mjs", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../../database/migrations/202611050002_catalogue_video_posters.sql", import.meta.url), "utf8");
  assert.match(route, /resolveCataloguePoster/);
  assert.match(route, /getProcessedObject/);
  assert.match(worker, /\/api\/catalogue\/poster\//);
  assert.match(migration, /i\.ytimg\.com\/vi/);
  assert.match(migration, /\/api\/catalogue\/poster\//);
});
