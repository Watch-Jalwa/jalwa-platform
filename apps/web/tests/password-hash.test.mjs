import assert from "node:assert/strict";
import test from "node:test";

const { hashPassword, verifyPassword, validateLearnerPassword } = await import("../lib/auth/password-hash.mjs");

test("learner password rules match SkillUp handoff", () => {
  assert.equal(validateLearnerPassword("Abc@123"), true);
  assert.equal(validateLearnerPassword("short1!"), false); // no upper? short1! has no upper
  assert.equal(validateLearnerPassword("SHORT1!"), false);
  assert.equal(validateLearnerPassword("Shortaa!"), false);
  assert.equal(validateLearnerPassword("Short12"), false);
  assert.equal(validateLearnerPassword("Ab1!"), false);
});

test("password hash verifies Abc@123", async () => {
  const hash = await hashPassword("Abc@123");
  assert.match(hash, /^[0-9a-f]+:[0-9a-f]+$/i);
  assert.equal(await verifyPassword({ hash, password: "Abc@123" }), true);
  assert.equal(await verifyPassword({ hash, password: "Wrong@12" }), false);
});
