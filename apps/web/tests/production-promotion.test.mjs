import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("production promotes staging-certified image digests instead of rebuilding", async () => {
  const workflow = await read(".github/workflows/deploy-production.yml");
  const compose = await read("infrastructure/production/docker-compose.yml");
  const deploy = await read("infrastructure/production/scripts/deploy-release.sh");

  assert.doesNotMatch(workflow, /docker\/build-push-action|Build and push immutable production/i);
  assert.match(workflow, /certification_run_id:/);
  assert.match(workflow, /payment_sandbox_run_id:/);
  assert.match(workflow, /uat_approval_reference:/);
  assert.match(workflow, /READY FOR UAT/);
  assert.match(workflow, /repo_digest/);
  assert.match(workflow, /JALWA_WEB_IMAGE/);
  assert.match(workflow, /JALWA_WORKER_IMAGE/);
  assert.match(workflow, /docker pull '\$JALWA_WEB_IMAGE'/);
  assert.match(workflow, /docker pull '\$JALWA_WORKER_IMAGE'/);
  assert.match(workflow, /capture-release-identity\.sh '\$RELEASE_SHA' '\$STAGING_BUILD_RUN_ID'/);

  assert.match(compose, /image: \$\{JALWA_WEB_IMAGE:-/);
  assert.match(compose, /image: \$\{JALWA_WORKER_IMAGE:-/);
  assert.match(deploy, /JALWA_WEB_IMAGE=/);
  assert.match(deploy, /JALWA_WORKER_IMAGE=/);
  assert.match(deploy, /\.images\.env/);
});

test("production requires a real provider sandbox for the exact release and provider", async () => {
  const sandbox = await read(".github/workflows/payment-sandbox-certification.yml");
  const spec = await read("qa/playwright/provider-sandbox.spec.mjs");
  const production = await read(".github/workflows/deploy-production.yml");

  assert.match(sandbox, /STAGING_PAYMENT_PROVIDER/);
  assert.match(sandbox, /STAGING_PAYMENT_EXPECTED_HOST/);
  assert.match(sandbox, /payfast\|jazzcash\|easypaisa|payfast.*jazzcash.*easypaisa/s);
  assert.match(sandbox, /mock\|'\'/);
  assert.match(sandbox, /REAL PAYMENT SANDBOX FAILED — PRODUCTION BLOCKED/);
  assert.match(sandbox, /payment-sandbox-report\.json/);

  assert.match(spec, /\/api\/webhooks\/payments\/\$\{provider\}/);
  assert.match(spec, /createHmac\("sha256"/);
  assert.match(spec, /signed_webhook_lifecycle: "succeeded"/);
  assert.match(spec, /redirect\.hostname\.toLowerCase\(\)/);
  assert.doesNotMatch(spec, /Complete test payment/);

  assert.match(production, /Payment provider sandbox certification/);
  assert.match(production, /\.provider == \$provider/);
  assert.match(production, /signed_webhook_lifecycle == "succeeded"/);
});

test("release identity separates build provenance from deployment provenance", async () => {
  const capture = await read("infrastructure/production/scripts/capture-release-identity.sh");
  const verify = await read("scripts/verify-release-identity.mjs");

  assert.match(capture, /build_pipeline_id/);
  assert.match(capture, /deployment_pipeline_id/);
  assert.match(capture, /build_run_id.*build_pipeline_id/s);
  assert.match(verify, /expectedBuildPipeline/);
  assert.match(verify, /captured build pipeline ID differs/);
  assert.match(verify, /deployment pipeline ID differs/);
});
