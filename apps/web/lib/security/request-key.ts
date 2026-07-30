import { createHash } from "node:crypto";

export function requestRateKey(request: Request, scope: string, userId?: string | null) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || process.env.MEDIA_SIGNING_SECRET || "jalwa-development-salt";
  return createHash("sha256").update(`${scope}:${userId ?? "anonymous"}:${address}:${salt}`).digest("hex");
}

export function safeSessionId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value) ? value : null;
}
