import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (relative) => readFile(new URL(relative, `file://${root.endsWith("/") ? root : `${root}/`}`), "utf8");

const paths = {
  dockerfile: "Dockerfile",
  deploy: ".github/workflows/deploy-staging.yml",
  certify: ".github/workflows/staging-acceptance.yml",
  finalizer: "scripts/finalize-staging-certification.mjs",
  identityCapture: "infrastructure/production/scripts/capture-release-identity.sh",
  identityVerify: "scripts/verify-release-identity.mjs",
  customer: "scripts/staging-customer-certification.mjs",
  studio: "scripts/staging-studio-certification.mjs",
  media: "scripts/staging-media-certification.mjs",
  visual: "scripts/staging-visual-certification.mjs",
  manifest: "qa/visual-baselines/manifest.json",
};

test("staging images carry immutable source and pipeline labels", async () => {
  const [dockerfile, deploy] = await Promise.all([read(paths.dockerfile), read(paths.deploy)]);
  assert.match(dockerfile, /org\.opencontainers\.image\.revision="\$GIT_SHA"/);
  assert.match(dockerfile, /com\.watch-jalwa\.build-run-id="\$BUILD_RUN_ID"/);
  assert.match(deploy, /GIT_SHA=\$\{\{ github\.sha \}\}/);
  assert.match(deploy, /BUILD_RUN_ID=\$\{\{ github\.run_id \}\}/);
  assert.match(deploy, /capture-release-identity\.sh '\$\{\{ github\.sha \}\}' '\$\{\{ github\.run_id \}\}'/);
});

test("gate zero verifies running image IDs, registry digests and OCI revisions", async () => {
  const [capture, verify] = await Promise.all([read(paths.identityCapture), read(paths.identityVerify)]);
  assert.match(capture, /docker compose .* ps -q/);
  assert.match(capture, /\.Config\.Labels "org\.opencontainers\.image\.revision"/);
  assert.match(capture, /\.RepoDigests/);
  assert.match(capture, /\.previous-good-image/);
  assert.match(verify, /web_digest/);
  assert.match(verify, /worker_digest/);
  assert.match(verify, /OCI revision mismatch/);
});

test("certification is automatic after Deploy staging and has only the three release decisions", async () => {
  const workflow = await read(paths.certify);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \["Deploy staging"\]/);
  assert.match(workflow, /READY FOR UAT/);
  assert.match(workflow, /FAILED — UAT BLOCKED/);
  assert.match(workflow, /BLOCKED — UAT BLOCKED/);
  assert.doesNotMatch(workflow, /Deploy production|deploy-production/i);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/);
});

test("all mandatory certification areas are fail closed", async () => {
  const finalizer = await read(paths.finalizer);
  for (const area of [
    "deployment_identity",
    "api_runtime",
    "public_browser",
    "authenticated_checkout",
    "payments",
    "studio_authorization",
    "media_catalogue",
    "mobile_purchase",
    "visual_regression",
  ]) assert.match(finalizer, new RegExp(`"${area}"`));
  assert.match(finalizer, /Mandatory certification result missing or invalid/);
  assert.match(finalizer, /certification-report\.json/);
  assert.match(finalizer, /certification-report\.html/);
});

test("customer certification covers auth denial, duplicate checkout, authoritative price, entitlements and full mobile payment", async () => {
  const customer = await read(paths.customer);
  assert.match(customer, /Unauthenticated checkout/);
  assert.match(customer, /Promise\.all/);
  assert.match(customer, /Duplicate checkout requests created different order IDs/);
  assert.match(customer, /amount_minor/);
  assert.match(customer, /paidOrder\.status !== "succeeded"/);
  assert.match(customer, /\/rest\/v1\/subscriptions/);
  assert.match(customer, /\/rest\/v1\/entitlements/);
  assert.match(customer, /Active subscription entitlements do not exactly match/);
  assert.match(customer, /Mobile purchase did not reach authoritative succeeded state/);
  assert.match(customer, /guest_cart_checkout: "N\/A"/);
});

test("Studio certification enforces admin and least-privilege route and API boundaries", async () => {
  const studio = await read(paths.studio);
  assert.match(studio, /"admin"/);
  assert.match(studio, /"rights_reviewer"/);
  assert.match(studio, /"viewer"/);
  assert.match(studio, /\/studio\/moderation/);
  assert.match(studio, /\/studio\/operations/);
  assert.match(studio, /restrictedApi\.status\(\) !== 403/);
  assert.match(studio, /viewerApi\.status\(\) !== 403/);
});

test("media and visual gates cannot silently pass missing fixtures or baselines", async () => {
  const [media, visual, manifestRaw] = await Promise.all([read(paths.media), read(paths.visual), read(paths.manifest)]);
  assert.match(media, /BLOCKED: no published staging catalogue item/);
  assert.match(visual, /VISUAL REVIEW REQUIRED/);
  assert.match(visual, /CI did not update the human-approved baseline manifest/);
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.schema_version, 1);
  assert.deepEqual(manifest.baselines, {});
});
