import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../app/api/ai/query/route.ts", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/set-ai-state.yml", import.meta.url);
const sqlUrl = new URL("../../../scripts/set-ai-state.sql", import.meta.url);

test("AI route fails closed on the shared flag before quota/provider work", async () => {
  const route = await readFile(routeUrl, "utf8");
  const flagIndex = route.indexOf('p_key: "ai_enabled"');
  const quotaIndex = route.indexOf('consume_ai_quota');
  const providerIndex = route.indexOf('moderateQuestion(question)');
  assert.ok(flagIndex >= 0);
  assert.ok(quotaIndex > flagIndex);
  assert.ok(providerIndex > flagIndex);
  assert.match(route, /code: "ai_disabled"/);
  assert.match(route, /code: "ai_state_unavailable"/);
});

test("AI state workflow is protected, exact-SHA and publicly verified", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /environment:\s*\n\s+name: \$\{\{ inputs\.target_environment \}\}/);
  assert.match(workflow, /git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/);
  assert.match(workflow, /scripts\/set-ai-state\.sql/);
  assert.match(workflow, /\.version \/\/ empty/);
  assert.match(workflow, /ai_disabled/);
  assert.match(workflow, /sign_in_required/);
  assert.doesNotMatch(workflow, /StrictHostKeyChecking=no/);
});

test("AI state SQL is transactional and audited", async () => {
  const sql = await readFile(sqlUrl, "utf8");
  assert.match(sql, /^\\set ON_ERROR_STOP on/m);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /platform_runtime_flags/);
  assert.match(sql, /'ai_enabled'/);
  assert.match(sql, /ai_workflow_state_changed/);
  assert.match(sql, /^commit;/m);
});
