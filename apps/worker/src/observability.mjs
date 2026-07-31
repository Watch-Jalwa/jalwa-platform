import { randomUUID } from "node:crypto";

const sensitivePattern = /((?:authorization|cookie|password|passwd|secret|token|api[_-]?key|session|signature|credential)["'=:\s]+)([^\s,;"']+)/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function redact(value, maximum = 12000) {
  return String(value ?? "")
    .slice(0, maximum)
    .replace(sensitivePattern, "$1[REDACTED]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(emailPattern, "[REDACTED_EMAIL]");
}

function normalize(input) {
  if (input instanceof Error) return { type: input.name || "Error", message: redact(input.message, 2000), stack: redact(input.stack, 12000) };
  return { type: "Error", message: redact(input, 2000), stack: "" };
}

function endpoint(dsn) {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (!projectId || !parsed.username) throw new Error("SENTRY_DSN is malformed");
  return { url: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`, publicKey: parsed.username };
}

export async function reportWorkerError(input, context = {}) {
  const error = normalize(input);
  const eventId = randomUUID().replaceAll("-", "");
  const release = process.env.GIT_SHA || "local";
  const base = {
    event: "worker_error",
    eventId,
    release,
    workerId: context.workerId,
    mechanism: context.mechanism || "worker",
    jobId: context.jobId,
    jobType: context.jobType,
    retry: context.retry,
    type: error.type,
    message: error.message,
  };
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.error(JSON.stringify(base));
    return { eventId, delivered: false };
  }

  try {
    const target = endpoint(dsn);
    const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn });
    const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
    const event = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      release,
      environment: process.env.NODE_ENV || "development",
      server_name: "jalwa-worker",
      logger: "jalwa.worker",
      tags: {
        service: "jalwa-worker",
        mechanism: context.mechanism || "worker",
        job_type: context.jobType,
        retry: context.retry,
      },
      exception: { values: [{ type: error.type, value: error.message, mechanism: { type: context.mechanism || "worker", handled: Boolean(context.handled) } }] },
      contexts: { worker: { worker_id: context.workerId, job_id: context.jobId, git_sha: release } },
      extra: { stack: error.stack },
    });
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=jalwa-worker/1.0`,
      },
      body: `${envelopeHeader}\n${itemHeader}\n${event}`,
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error(`Sentry returned ${response.status}`);
    return { eventId, delivered: true };
  } catch (deliveryError) {
    console.error(JSON.stringify({ ...base, deliveryError: redact(deliveryError instanceof Error ? deliveryError.message : deliveryError, 500) }));
    return { eventId, delivered: false };
  }
}
