import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reportWorkerError } from "../../worker/src/observability.mjs";

const paths = {
  bootstrap: new URL("../../../.github/workflows/bootstrap-staging.yml", import.meta.url),
  deploy: new URL("../../../.github/workflows/deploy-staging.yml", import.meta.url),
  acceptance: new URL("../../../.github/workflows/staging-acceptance.yml", import.meta.url),
  releaseAcceptance: new URL("../../../infrastructure/production/scripts/production-acceptance.sh", import.meta.url),
  hostAcceptance: new URL("../../../infrastructure/production/scripts/host-acceptance.sh", import.meta.url),
  readiness: new URL("../app/api/readiness/route.ts", import.meta.url),
  layout: new URL("../app/layout.tsx", import.meta.url),
  worker: new URL("../../worker/src/index.mjs", import.meta.url),
};

test("staging bootstrap isolates infrastructure and Terraform state", async () => {
  const source = await readFile(paths.bootstrap, "utf8");
  assert.match(source, /environment: staging/);
  assert.match(source, /key=staging\/digitalocean\.tfstate/);
  assert.match(source, /jalwa-staging-incoming/);
  assert.match(source, /jalwa-staging-media/);
  assert.match(source, /jalwa-staging-backups/);
  assert.match(source, /STAGING_SSH_KNOWN_HOSTS/);
  assert.doesNotMatch(source, /gh variable set PRODUCTION_/);
});

test("staging deploy is immutable, pinned and cannot enable production-only features", async () => {
  const source = await readFile(paths.deploy, "utf8");
  assert.match(source, /test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.match(source, /tags: \$\{\{ env\.WEB_IMAGE \}\}:\$\{\{ github\.sha \}\}/);
  assert.match(source, /tags: \$\{\{ env\.WORKER_IMAGE \}\}:\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(source, /:latest/);
  assert.match(source, /DEPLOYMENT_ENVIRONMENT=staging/);
  assert.match(source, /ALLOW_MOCK_PAYMENTS=true/);
  assert.match(source, /PAYMENT_PROVIDER=mock/);
  assert.match(source, /NEXT_PUBLIC_ENABLE_LIVE_STREAMING=false/);
  assert.match(source, /NEXT_PUBLIC_ENABLE_WEB_DRM=false/);
  assert.match(source, /BACKUP_AGE_IDENTITY/);
  assert.match(source, /\/opt\/jalwa\/secrets\/backup-age\.key/);
  assert.match(source, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(source, /ssh-keyscan/);
  assert.match(source, /restore-drill\.sh/);
  assert.match(source, /host-acceptance\.sh/);
});

test("live staging acceptance uses protected diagnostics and pinned SSH", async () => {
  const [workflow, script] = await Promise.all([
    readFile(paths.acceptance, "utf8"),
    readFile(paths.releaseAcceptance, "utf8"),
  ]);
  assert.match(workflow, /workflows: \["Deploy staging"\]/);
  assert.match(workflow, /JALWA_EXPECT_READINESS_STATUS: "200"/);
  assert.match(workflow, /JALWA_EXPECT_NOINDEX: "true"/);
  assert.match(workflow, /STAGING_SSH_KNOWN_HOSTS/);
  assert.doesNotMatch(workflow, /ssh-keyscan/);
  assert.match(script, /x-jalwa-operations-token/);
  assert.match(script, /EXPECTED_ENVIRONMENT/);
  assert.match(script, /EXPECT_NOINDEX/);
  assert.match(script, /ALLOW_MOCK_PAYMENTS/);
});

test("mock payments can report ready only in explicit staging", async () => {
  const [readiness, hostAcceptance] = await Promise.all([
    readFile(paths.readiness, "utf8"),
    readFile(paths.hostAcceptance, "utf8"),
  ]);
  assert.match(readiness, /deploymentEnvironment === "staging" && paymentProvider === "mock" && process\.env\.ALLOW_MOCK_PAYMENTS === "true"/);
  assert.match(hostAcceptance, /DEPLOYMENT_ENVIRONMENT:-production.*staging/);
  assert.match(hostAcceptance, /Mock payments are allowed only in an explicit staging deployment/);
});

test("staging is noindex and excluded from production analytics", async () => {
  const source = await readFile(paths.layout, "utf8");
  assert.match(source, /process\.env\.DEPLOYMENT_ENVIRONMENT === "staging"/);
  assert.match(source, /robots: isFrontendPreview \|\| isStaging/);
  assert.match(source, /isFrontendPreview \|\| isStaging \? null : <AnalyticsBeacon/);
});

test("worker errors are release-correlated and redact direct identifiers", async () => {
  const previousSha = process.env.GIT_SHA;
  const previousDsn = process.env.SENTRY_DSN;
  const previousError = console.error;
  const messages = [];
  process.env.GIT_SHA = "a".repeat(40);
  delete process.env.SENTRY_DSN;
  console.error = (message) => messages.push(String(message));
  try {
    const result = await reportWorkerError(new Error("token=secret-value user@example.com"), {
      workerId: "worker-test",
      mechanism: "media_job",
      jobId: "job-test",
      handled: true,
    });
    assert.equal(result.delivered, false);
    const event = JSON.parse(messages.at(-1));
    assert.equal(event.service, "jalwa-worker");
    assert.equal(event.release, "a".repeat(40));
    assert.equal(event.workerId, "worker-test");
    assert.equal(event.jobId, "job-test");
    assert.match(event.message, /\[REDACTED\]/);
    assert.match(event.message, /\[REDACTED_EMAIL\]/);
    assert.doesNotMatch(event.message, /secret-value|user@example\.com/);
  } finally {
    console.error = previousError;
    if (previousSha === undefined) delete process.env.GIT_SHA; else process.env.GIT_SHA = previousSha;
    if (previousDsn === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = previousDsn;
  }
});

test("worker captures handled job failures and fatal process failures", async () => {
  const source = await readFile(paths.worker, "utf8");
  assert.match(source, /reportWorkerError\(error,\s*\{\s*workerId,\s*mechanism:\s*"media_job"/);
  assert.match(source, /reportWorkerError\(error,\s*\{\s*workerId,\s*mechanism:\s*"drm_packaging_job"/);
  assert.match(source, /process\.once\("uncaughtException"/);
  assert.match(source, /process\.once\("unhandledRejection"/);
  assert.match(source, /mechanism: "worker_tick"/);
});
