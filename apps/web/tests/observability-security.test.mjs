import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("readiness hides operational details without an operations token", async () => {
  const source = await read("apps/web/app/api/readiness/route.ts");
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /x-jalwa-operations-token/);
  assert.match(source, /if \(!authorized\(request\)\)/);
  const publicBlock = source.slice(source.indexOf("if (!authorized(request))"), source.indexOf("return NextResponse.json({", source.indexOf("if (!authorized(request))") + 1));
  assert.doesNotMatch(publicBlock, /missingConfiguration|migrationIssues|paymentProvider/);
});

test("browser and server failures emit bounded redacted events", async () => {
  const [eventSource, instrumentation, intake] = await Promise.all([
    read("apps/web/lib/observability/event.ts"),
    read("apps/web/instrumentation.ts"),
    read("apps/web/app/api/observability/client-error/route.ts"),
  ]);
  assert.match(eventSource, /sensitiveKey/);
  assert.match(eventSource, /\[redacted\]/);
  assert.match(eventSource, /GIT_SHA/);
  assert.match(instrumentation, /Instrumentation\.onRequestError/);
  assert.match(instrumentation, /NEXT_RUNTIME !== "nodejs"/);
  assert.match(intake, /16384/);
  assert.match(intake, /consume_rate_limit/);
});

test("CSP is enforced and violations are collected", async () => {
  const [caddy, route] = await Promise.all([
    read("infrastructure/production/Caddyfile"),
    read("apps/web/app/api/security/csp-report/route.ts"),
  ]);
  assert.match(caddy, /Content-Security-Policy "/);
  assert.match(caddy, /Content-Security-Policy-Report-Only/);
  assert.match(caddy, /report-uri \/api\/security\/csp-report/);
  assert.match(route, /security\.csp_violation/);
  assert.match(route, /16384/);
});
