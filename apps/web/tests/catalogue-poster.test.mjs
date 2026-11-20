import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { curatedPosterUrlForSlug } from "../lib/catalogue/curated-posters.mjs";
import { buildGeneratedPosterSvg, resolvePosterTheme } from "../lib/catalogue/generated-poster.mjs";
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

test("provided catalogue thumbnails override only matched slugs", () => {
  assert.equal(
    withCataloguePosterFallback({ slug: "sintel", contentType: "video", thumbnailUrl: "https://cdn.example/old.jpg" }).thumbnailUrl,
    "/catalogue/thumbnails/sintel.jpeg",
  );
  assert.equal(
    withCataloguePosterFallback({ slug: "unmatched-video", contentType: "video", thumbnailUrl: "https://cdn.example/current.jpg" }).thumbnailUrl,
    "https://cdn.example/current.jpg",
  );
});

test("generated posters include title category and brand without video frames", () => {
  const svg = buildGeneratedPosterSvg({
    id: "a2de188e-f7aa-4c28-8c06-e487c9a75a69",
    slug: "sintel",
    title: "Sintel",
    category: "Entertainment",
    contentType: "video",
    durationSeconds: 888,
  });
  assert.match(svg, /<svg /);
  assert.match(svg, /Sintel/);
  assert.match(svg, /ENTERTAINMENT/);
  assert.match(svg, /JALWA/);
  assert.match(svg, /14m/);
  assert.doesNotMatch(svg, /thumbnail\.jpg/);
  assert.equal(resolvePosterTheme({ slug: "vhs-static-cc0-clip", title: "Analog" }).motif, "static");
  assert.equal(resolvePosterTheme({ slug: "apollo-11-eagle-has-landed" }).motif, "stars");
});

test("curated open-movie posters use official stills", () => {
  assert.match(curatedPosterUrlForSlug("sintel") ?? "", /Sintel_poster/);
  assert.match(curatedPosterUrlForSlug("cosmos-laundromat") ?? "", /CosmosLaundromatPoster/);
  assert.match(curatedPosterUrlForSlug("sprite-fright") ?? "", /Sprite_Fright/);
  assert.match(curatedPosterUrlForSlug("caminandes-llamigos") ?? "", /Caminandes/);
  assert.match(curatedPosterUrlForSlug("grca-south-rim-summer-timelapse") ?? "", /Grand_Canyon/);
  assert.equal(curatedPosterUrlForSlug("unknown-slug"), null);
});

test("poster route serves curated or generated catalogue art", async () => {
  const route = await readFile(new URL("../app/api/catalogue/poster/[contentId]/route.ts", import.meta.url), "utf8");
  const poster = await readFile(new URL("../lib/catalogue/poster.mjs", import.meta.url), "utf8");
  const repository = await readFile(new URL("../lib/catalogue/repository.ts", import.meta.url), "utf8");
  assert.match(route, /buildGeneratedPosterSvg/);
  assert.match(route, /X-Jalwa-Poster": "generated"/);
  assert.doesNotMatch(route, /getProcessedObject/);
  assert.match(poster, /kind: "generated"/);
  assert.match(poster, /curatedPosterUrlForSlug/);
  assert.match(repository, /queryLimit/);
  assert.match(repository, /p_limit: queryLimit/);
  assert.match(repository, /filtered\.slice\(0, requested\)/);
});
