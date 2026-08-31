import { timingSafeEqual } from "node:crypto";

export function stagingQaAuthorized(request: Request) {
  if (process.env.DEPLOYMENT_ENVIRONMENT !== "staging") return false;
  const expected = process.env.STAGING_QA_SECRET ?? "";
  const supplied = request.headers.get("x-jalwa-qa-token") ?? "";
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function qaEmailAllowed(email: string) {
  const allowlist = (process.env.STAGING_QA_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

export function safeQaNextPath(value: unknown) {
  const path = typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
  return path.slice(0, 512);
}
