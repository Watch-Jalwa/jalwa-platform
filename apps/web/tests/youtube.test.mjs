import assert from "node:assert/strict";
import test from "node:test";
import { canonicalYouTubeUrl, parseYouTubeVideoId } from "../lib/youtube/parse.mjs";

const id = "dQw4w9WgXcQ";

test("YouTube parser accepts supported URL shapes", () => {
  assert.equal(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(parseYouTubeVideoId(`https://youtu.be/${id}`), id);
  assert.equal(parseYouTubeVideoId(`https://www.youtube.com/shorts/${id}`), id);
});

test("YouTube parser rejects deceptive hosts", () => {
  assert.equal(parseYouTubeVideoId(`https://youtube.com.example.org/watch?v=${id}`), null);
  assert.equal(parseYouTubeVideoId("not-a-url"), null);
});

test("canonical URL is stable", () => {
  assert.equal(canonicalYouTubeUrl(id), `https://www.youtube.com/watch?v=${id}`);
});
