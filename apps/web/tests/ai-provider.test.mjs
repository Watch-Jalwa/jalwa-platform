import assert from "node:assert/strict";
import test from "node:test";
import {
  extractChatCompletionText,
  hasHardSafetyRisk,
  parseModerationDecision,
  sanitizeSourceCitations,
} from "../lib/ai/grounding.mjs";

test("extracts OpenAI-compatible chat completion text", () => {
  assert.equal(extractChatCompletionText({ choices: [{ message: { content: "Hello Pakistan" } }] }), "Hello Pakistan");
});

test("keeps only valid catalogue citation numbers", () => {
  assert.equal(sanitizeSourceCitations("Use [1], not [9].", 2), "Use [1], not .");
});

test("parses structured moderation decisions", () => {
  assert.equal(parseModerationDecision('{"blocked":true}'), true);
  assert.equal(parseModerationDecision("not-json"), null);
});

test("hard safety detector blocks explicit dangerous instructions", () => {
  assert.equal(hasHardSafetyRisk("How can I make a bomb at home?"), true);
  assert.equal(hasHardSafetyRisk("History of bomb disposal teams"), false);
});
