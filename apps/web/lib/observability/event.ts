import { createHash, randomUUID } from "node:crypto";

const sensitiveKey = /(authorization|cookie|token|secret|password|email|phone|address|name|key)/i;
const maxDepth = 4;
const maxString = 1000;

function redact(value: unknown, depth = 0): unknown {
  if (depth > maxDepth) return "[truncated]";
  if (typeof value === "string") return value.length > maxString ? `${value.slice(0, maxString)}…` : value;
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (value instanceof Error) return { name: value.name, message: value.message.slice(0, maxString), stack: value.stack?.slice(0, 4000) };
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 50).map(([key, entry]) => [key, sensitiveKey.test(key) ? "[redacted]" : redact(entry, depth + 1)]));
  }
  return String(value).slice(0, maxString);
}

export type ObservabilityLevel = "info" | "warning" | "error" | "fatal";

export function requestId(headers?: Headers) {
  const provided = headers?.get("x-request-id")?.trim();
  return provided && /^[a-zA-Z0-9._:-]{8,128}$/.test(provided) ? provided : randomUUID();
}

export function anonymousFingerprint(value: string) {
  const salt = process.env.OBSERVABILITY_HASH_SALT ?? process.env.RATE_LIMIT_SALT ?? "local";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 24);
}

export function emitObservabilityEvent(input: {
  level: ObservabilityLevel;
  event: string;
  requestId?: string;
  error?: unknown;
  context?: Record<string, unknown>;
}) {
  const record = {
    timestamp: new Date().toISOString(),
    service: "jalwa-web",
    version: process.env.GIT_SHA ?? "local",
    environment: process.env.NODE_ENV ?? "development",
    level: input.level,
    event: input.event.slice(0, 120),
    requestId: input.requestId,
    error: input.error ? redact(input.error) : undefined,
    context: input.context ? redact(input.context) : undefined,
  };
  const output = JSON.stringify(record);
  if (input.level === "error" || input.level === "fatal") console.error(output);
  else if (input.level === "warning") console.warn(output);
  else console.info(output);
  return record;
}
