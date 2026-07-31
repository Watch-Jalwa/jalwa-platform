import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function authorizeInternalRequest(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const provided = authorization.slice(7).trim();
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(configured));
}
