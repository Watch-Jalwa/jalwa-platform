import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

const canonicalStudioRoutes = [
  ["apps/web/app/studio/rights/page.tsx", /<h1>Rights<\/h1>/],
  ["apps/web/app/studio/rights/operations/page.tsx", /<h1>Rights operations<\/h1>/],
  ["apps/web/app/studio/media/page.tsx", /<h1>Media<\/h1>/],
  ["apps/web/app/studio/payments/page.tsx", /<h1>Payment operations<\/h1>/],
  ["apps/web/app/studio/privacy/page.tsx", /<h1>Privacy<\/h1>/],
  ["apps/web/app/studio/ai/page.tsx", /<h1>AI operations<\/h1>/],
];

test("canonical Studio certification routes are implemented as authorization-aware surfaces", async () => {
  for (const [path, heading] of canonicalStudioRoutes) {
    const source = await file(path);
    assert.match(source, /requireStaff\(\)/, `${path} must require an authenticated Studio identity`);
    assert.match(source, heading, `${path} must expose its canonical Studio surface`);
  }
});

test("Studio guard distinguishes signed-in subscriber denial from ordinary viewer denial", async () => {
  const auth = await file("apps/web/lib/studio/auth.ts");
  const denied = await file("apps/web/app/permission-denied/page.tsx");
  assert.match(auth, /profile\.role === "subscriber"/);
  assert.match(auth, /redirect\("\/permission-denied\?scope=studio"\)/);
  assert.match(auth, /redirect\("\/"\)/);
  assert.match(denied, /Permission denied/);
});

test("rights surfaces explicitly admit rights reviewers and administrators", async () => {
  const overview = await file("apps/web/app/studio/rights/page.tsx");
  const operations = await file("apps/web/app/studio/rights/operations/page.tsx");
  for (const source of [overview, operations]) {
    assert.match(source, /profile\.role !== "rights_reviewer" && profile\.role !== "admin"/);
    assert.match(source, /rights_operations/);
  }
});

test("server session lookup retries once but still fails closed", async () => {
  const server = await file("apps/web/lib/database/server.ts");
  const runtimeLookups = server.match(/await auth\.api\.getSession/g) ?? [];
  assert.equal(runtimeLookups.length, 2);
  assert.match(server, /auth_session_lookup_retry/);
  assert.match(server, /catch \{ session = null; \}/);
});
