import "server-only";
import { randomUUID } from "node:crypto";

type ErrorContext = {
  mechanism: string;
  route?: string;
  method?: string;
  routeType?: string;
  routerKind?: string;
  digest?: string;
  requestId?: string;
  tags?: Record<string, string | number | boolean | null | undefined>;
};

const sensitivePattern = /((?:authorization|cookie|password|passwd|secret|token|api[_-]?key|session|signature|credential)["'=:\s]+)([^\s,;"']+)/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

export function redactErrorText(value: unknown, maximum = 12000) {
  return String(value ?? "")
    .slice(0, maximum)
    .replace(sensitivePattern, "$1[REDACTED]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(ipv4Pattern, "[REDACTED_IP]");
}

function normalizeError(input: unknown) {
  if (input instanceof Error) {
    return {
      type: input.name || "Error",
      message: redactErrorText(input.message, 2000),
      stack: redactErrorText(input.stack ?? "", 12000),
    };
  }
  return { type: "Error", message: redactErrorText(input, 2000), stack: "" };
}

function sentryEndpoint(dsn: string) {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (!projectId || !parsed.username) throw new Error("SENTRY_DSN is malformed");
  return {
    endpoint: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
    publicKey: parsed.username,
  };
}

function safeTags(tags: ErrorContext["tags"] = {}) {
  return Object.fromEntries(
    Object.entries(tags)
      .filter(([, value]) => value !== undefined)
      .slice(0, 30)
      .map(([key, value]) => [key.slice(0, 64), redactErrorText(value, 200)]),
  );
}

export async function reportServerError(input: unknown, context: ErrorContext) {
  const normalized = normalizeError(input);
  const eventId = randomUUID().replaceAll("-", "");
  const release = process.env.GIT_SHA || "local";
  const environment = process.env.NODE_ENV || "development";
  const requestId = context.requestId || eventId;
  const baseLog = {
    event: "application_error",
    eventId,
    requestId,
    release,
    environment,
    mechanism: context.mechanism,
    route: context.route,
    method: context.method,
    type: normalized.type,
    message: normalized.message,
  };

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.error(JSON.stringify(baseLog));
    return { eventId, delivered: false };
  }

  try {
    const { endpoint, publicKey } = sentryEndpoint(dsn);
    const sentAt = new Date().toISOString();
    const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn });
    const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
    const event = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      release,
      environment,
      server_name: "jalwa-web",
      logger: "jalwa.observability",
      tags: {
        service: "jalwa-web",
        mechanism: context.mechanism,
        route_type: context.routeType,
        router_kind: context.routerKind,
        ...safeTags(context.tags),
      },
      exception: {
        values: [{
          type: normalized.type,
          value: normalized.message,
          stacktrace: normalized.stack ? { frames: [], raw: normalized.stack } : undefined,
          mechanism: { type: context.mechanism, handled: false },
        }],
      },
      contexts: {
        release: { git_sha: release },
        request: {
          request_id: requestId,
          method: context.method,
          route: context.route,
          digest: context.digest,
        },
      },
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=jalwa/1.0`,
      },
      body: `${envelopeHeader}\n${itemHeader}\n${event}`,
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Sentry returned ${response.status}`);
    return { eventId, delivered: true };
  } catch (deliveryError) {
    console.error(JSON.stringify({
      ...baseLog,
      deliveryError: redactErrorText(deliveryError instanceof Error ? deliveryError.message : deliveryError, 500),
    }));
    return { eventId, delivered: false };
  }
}
