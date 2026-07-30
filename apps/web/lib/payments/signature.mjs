import { createHmac, timingSafeEqual } from "node:crypto";

export function signPaymentPayload(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyPaymentSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  const expected = signPaymentPayload(payload, secret);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(signature, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
