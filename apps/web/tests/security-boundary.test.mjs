import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicReadinessUrl = new URL("../app/api/readiness/route.ts", import.meta.url);
const internalReadinessUrl = new URL("../app/api/internal/readiness/route.ts", import.meta.url);
const internalAuthUrl = new URL("../lib/security/internal-auth.ts", import.meta.url);
const cspReportUrl = new URL("../app/api/security/csp-report/route.ts", import.meta.url);
const caddyUrl = new URL("../../../infrastructure/production/Caddyfile", import.meta.url);

async function source(url) { return readFile(url, "utf8"); }

test("public readiness exposes only status and immutable release identity", async () => {
  const route = await source(publicReadinessUrl);
  assert.match(route, /service: details\.service/);
  assert.match(route, /status: details\.status/);
  assert.match(route, /version: details\.version/);
  assert.doesNotMatch(route, /missingConfiguration/);
  assert.doesNotMatch(route, /migrationIssues/);
  assert.doesNotMatch(route, /paymentProvider/);
});

test("detailed readiness requires constant-time bearer authorization", async () => {
  const [route, auth] = await Promise.all([source(internalReadinessUrl), source(internalAuthUrl)]);
  assert.match(route, /authorizeInternalRequest\(request\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /WWW-Authenticate/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /createHash\("sha256"\)/);
  assert.match(auth, /process\.env\.CRON_SECRET/);
});

test("CSP reporting is bounded, sanitized and rate limited", async () => {
  const route = await source(cspReportUrl);
  assert.match(route, /MAX_BODY_BYTES = 32 \* 1024/);
  assert.match(route, /LIMIT_PER_WINDOW = 60/);
  assert.match(route, /Buffer\.byteLength\(raw, "utf8"\)/);
  assert.match(route, /url\.pathname\.slice\(0, 500\)/);
  assert.match(route, /reports\.slice\(0, 20\)/);
  assert.match(route, /status: 413/);
  assert.doesNotMatch(route, /console\.warn\(raw/);
});

test("production proxy enforces CSP and retains stricter reporting policy", async () => {
  const caddy = await source(caddyUrl);
  assert.match(caddy, /Content-Security-Policy "/);
  assert.match(caddy, /Content-Security-Policy-Report-Only "/);
  assert.match(caddy, /Reporting-Endpoints/);
  assert.match(caddy, /report-uri \/api\/security\/csp-report/);
  assert.match(caddy, /script-src-attr 'none'/);
  assert.match(caddy, /Cross-Origin-Opener-Policy "same-origin-allow-popups"/);
  assert.match(caddy, /X-Permitted-Cross-Domain-Policies "none"/);
  assert.doesNotMatch(caddy, /connect-src[^;]*api\.deepseek\.com/);
});
