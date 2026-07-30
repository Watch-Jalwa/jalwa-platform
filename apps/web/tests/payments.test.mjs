import test from "node:test";
import assert from "node:assert/strict";
import { signPaymentPayload, verifyPaymentSignature } from "../lib/payments/signature.mjs";

test("payment webhook signatures verify", () => {
  const payload = JSON.stringify({ eventId: "evt_1", amountMinor: 29900 });
  const signature = signPaymentPayload(payload, "secret");
  assert.equal(verifyPaymentSignature(payload, signature, "secret"), true);
  assert.equal(verifyPaymentSignature(`${payload}x`, signature, "secret"), false);
  assert.equal(verifyPaymentSignature(payload, signature, "wrong"), false);
});

test("payment signature rejects malformed hex", () => {
  assert.equal(verifyPaymentSignature("{}", "invalid", "secret"), false);
});
