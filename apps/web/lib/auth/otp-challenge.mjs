import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is required for OTP challenges.");
  return value;
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(body) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createOtpChallengeId(channel, identity, ttlSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = { v: 1, channel, identity, exp };
  const body = toBase64Url(JSON.stringify(payload));
  return {
    challengeId: `${body}.${sign(body)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function readOtpChallengeId(challengeId) {
  const [body, signature] = String(challengeId ?? "").split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload?.v !== 1 || (payload.channel !== "email" && payload.channel !== "phone")) return null;
    if (!payload.identity || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
