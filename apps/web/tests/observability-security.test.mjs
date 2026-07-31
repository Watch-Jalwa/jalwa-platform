import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const instrumentationUrl = new URL("../instrumentation.ts", import.meta.url);
const clientInstrumentationUrl = new URL("../instrumentation-client.ts", import.meta.url);
const serverReporterUrl = new URL("../lib/observability/server.ts", import.meta.url);
const clientReporterUrl = new URL("../lib/observability/client.ts", import.meta.url);
const intakeUrl = new URL("../app/api/observability/errors/route.ts", import.meta.url);
const globalErrorUrl = new URL("../app/global-error.tsx", import.meta.url);
const workerUrl = new URL("../../worker/src/index.mjs", import.meta.url);
const workerReporterUrl = new URL("../../worker/src/observability.mjs", import.meta.url);

async function text(url) { return readFile(url, "utf8"); }

test("server and browser instrumentation capture uncaught failures", async () => {
  const [server, client, globalError] = await Promise.all([
    text(instrumentationUrl),
    text(clientInstrumentationUrl),
    text(globalErrorUrl),
  ]);
  assert.match(server, /onRequestError/);
  assert.match(server, /reportServerError/);
  assert.match(client, /window\.addEventListener\("error"/);
  assert.match(client, /window\.addEventListener\("unhandledrejection"/);
  assert.match(globalError, /reportClientError/);
});

test("error delivery redacts secrets and correlates the release", async () => {
  const [server, client] = await Promise.all([text(serverReporterUrl), text(clientReporterUrl)]);
  assert.match(server, /SENTRY_DSN/);
  assert.match(server, /process\.env\.GIT_SHA/);
  assert.match(server, /\[REDACTED\]/);
  assert.match(server, /AbortSignal\.timeout\(2500\)/);
  assert.match(client, /\[REDACTED_EMAIL\]/);
  assert.match(client, /payload\.length > 14000/);
});

test("browser error intake is bounded, same-origin and rate limited", async () => {
  const route = await text(intakeUrl);
  assert.match(route, /MAX_BODY_BYTES = 16 \* 1024/);
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /LIMIT_PER_WINDOW = 20/);
  assert.match(route, /Buffer\.byteLength\(raw, "utf8"\)/);
  assert.match(route, /status: 413/);
  assert.match(route, /status: 403/);
});

test("worker failures include job and fatal process reporting", async () => {
  const [worker, reporter] = await Promise.all([text(workerUrl), text(workerReporterUrl)]);
  assert.match(worker, /reportWorkerError/);
  assert.match(worker, /uncaughtException/);
  assert.match(worker, /unhandledRejection/);
  assert.match(worker, /media_job/);
  assert.match(worker, /drm_packaging_job/);
  assert.match(reporter, /SENTRY_DSN/);
  assert.match(reporter, /process\.env\.GIT_SHA/);
  assert.match(reporter, /\[REDACTED\]/);
});
