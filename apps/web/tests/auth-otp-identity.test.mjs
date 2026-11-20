import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-for-otp-identity";

const { maskIdentity, normalizePakistaniMobile, parseIdentity, validateDisplayName } = await import("../lib/auth/identity.mjs");
const { createOtpChallengeId, readOtpChallengeId } = await import("../lib/auth/otp-challenge.mjs");

test("parseIdentity accepts email and Pakistani mobile formats", () => {
  assert.deepEqual(parseIdentity("You@Example.com"), {
    ok: true,
    channel: "email",
    identity: "you@example.com",
    normalized: "you@example.com",
  });
  assert.equal(normalizePakistaniMobile("0300 1234567"), "+923001234567");
  assert.equal(normalizePakistaniMobile("+923001234567"), "+923001234567");
  assert.equal(parseIdentity("03001234567").normalized, "+923001234567");
  assert.equal(parseIdentity("not-an-email").ok, false);
});

test("display name and masking follow the signup field contract", () => {
  assert.equal(validateDisplayName("A"), null);
  assert.equal(validateDisplayName("Ali Khan"), "Ali Khan");
  assert.equal(maskIdentity("email", "ali@example.com"), "al***@example.com");
  assert.match(maskIdentity("phone", "+923001234567"), /^\+923\*\*\*\d{3}$/);
});

test("OTP challenge ids are signed and expire-checked", () => {
  const { challengeId, expiresAt } = createOtpChallengeId("email", "you@example.com", 60);
  assert.ok(Date.parse(expiresAt) > Date.now());
  const payload = readOtpChallengeId(challengeId);
  assert.equal(payload.v, 1);
  assert.equal(payload.channel, "email");
  assert.equal(payload.identity, "you@example.com");
  assert.equal(payload.exp, Math.floor(Date.parse(expiresAt) / 1000));

  const [body] = challengeId.split(".");
  const badSig = createHmac("sha256", "other-secret").update(body).digest("base64url");
  assert.equal(readOtpChallengeId(`${body}.${badSig}`), null);
});
