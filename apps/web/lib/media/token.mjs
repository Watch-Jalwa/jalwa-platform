import { createHmac, timingSafeEqual } from "node:crypto";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signPlaybackToken(payload, secret, ttlSeconds = 300) {
  if (!secret) throw new Error("MEDIA_SIGNING_SECRET is required");
  const body = encode({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPlaybackToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}
