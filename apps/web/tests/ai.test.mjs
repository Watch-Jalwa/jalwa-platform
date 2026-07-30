import test from "node:test";
import assert from "node:assert/strict";
import { buildRetrievalQuery, buildSourceContext, extractResponseText, sanitizeSourceCitations } from "../lib/ai/grounding.mjs";

test("retrieval query removes filler words and limits terms", () => {
  assert.equal(buildRetrievalQuery("Mujhe cotton ki pani bachanay wali farming videos dikhao"), "cotton pani bachanay wali farming videos dikhao");
  assert.equal(buildRetrievalQuery("the and how what"), "");
});

test("response text is extracted from Responses API output", () => {
  assert.equal(extractResponseText({ output_text: "Direct" }), "Direct");
  assert.equal(extractResponseText({ output: [{ content: [{ type: "output_text", text: "Nested" }] }] }), "Nested");
});

test("invalid citations are removed", () => {
  assert.equal(sanitizeSourceCitations("Use [1] not [9].", 2), "Use [1] not .");
});

test("source context includes only supplied catalogue fields", () => {
  const context = buildSourceContext([{ id: "1", slug: "cotton-water", title: "Cotton water guide", category: "Kissan" }]);
  assert.match(context, /\[1\] Cotton water guide/);
  assert.match(context, /\/watch\/cotton-water/);
});
