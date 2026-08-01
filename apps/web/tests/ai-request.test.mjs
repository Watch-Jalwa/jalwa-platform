import assert from "node:assert/strict";
import test from "node:test";
import { AiRequestBodyError, isAiEnabled, readAiRequestBody } from "../lib/ai/request.mjs";

async function expectBodyError(request, maxBytes, status) {
  await assert.rejects(
    () => readAiRequestBody(request, maxBytes),
    (error) => error instanceof AiRequestBodyError && error.status === status,
  );
}

test("AI runtime state defaults on and requires an explicit true value", () => {
  const previous = process.env.AI_ENABLED;
  try {
    delete process.env.AI_ENABLED;
    assert.equal(isAiEnabled(), true);
    assert.equal(isAiEnabled("true"), true);
    assert.equal(isAiEnabled(" TRUE "), true);
    assert.equal(isAiEnabled("false"), false);
    assert.equal(isAiEnabled("1"), false);
  } finally {
    if (previous === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = previous;
  }
});

test("reads a bounded JSON object", async () => {
  const request = new Request("https://example.test/api/ai/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "Cotton irrigation" }),
  });
  assert.deepEqual(await readAiRequestBody(request, 1_024), { question: "Cotton irrigation" });
});

test("rejects an oversized declared content length before parsing", async () => {
  const request = new Request("https://example.test/api/ai/query", {
    method: "POST",
    headers: { "content-length": "20000", "content-type": "application/json" },
    body: "{}",
  });
  await expectBodyError(request, 16_384, 413);
});

test("rejects oversized UTF-8 content when content length is absent", async () => {
  const request = new Request("https://example.test/api/ai/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "پ".repeat(20) }),
  });
  await expectBodyError(request, 32, 413);
});

test("rejects malformed JSON and non-object payloads", async () => {
  await expectBodyError(new Request("https://example.test", { method: "POST", body: "{" }), 100, 400);
  await expectBodyError(new Request("https://example.test", { method: "POST", body: "[]" }), 100, 400);
});
