import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const root = fileURLToPath(rootUrl);
const urlFor = (relative) => new URL(relative, rootUrl);
const read = (relative) => readFile(urlFor(relative), "utf8");

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
  mediaFixturePreflight: "scripts/staging-media-fixture-preflight.mjs",
  visual: "scripts/staging-visual-certification.mjs",
  manifest: "qa/visual-baselines/manifest.json",
  playwrightConfig: "playwright.staging.config.mjs",
  playwrightHelper: "qa/playwright/helpers/staging.mjs",
  playwrightPublic: "qa/playwright/public.spec.mjs",
  playwrightAuth: "qa/playwright/auth.spec.mjs",
  playwrightResponsive: "qa/playwright/responsive.spec.mjs",
  playwrightCustomer: "qa/playwright/customer.spec.mjs",
  playwrightStudio: "qa/playwright/studio.spec.mjs",
  playwrightMedia: "qa/playwright/media.spec.mjs",
  playwrightVisual: "qa/playwright/visual.spec.mjs",
};

test("staging images carry immutable source and pipeline labels", async () => {
  const [dockerfile, deploy] = await Promise.all([read(paths.dockerfile), read(paths.deploy)]);
  assert.match(dockerfile, /org\.opencontainers\.image\.revision="\$GIT_SHA"/);
  assert.match(dockerfile, /com\.watch-jalwa\.build-run-id="\$BUILD_RUN_ID"/);
  assert.match(deploy, /GIT_SHA=\$\{\{ github\.sha \}\}/);
  assert.match(deploy, /BUILD_RUN_ID=\$\{\{ github\.run_id \}\}/);
  assert.match(deploy, /RELEASE_SHA='\$GITHUB_SHA' BUILD_RUN_ID='\$GITHUB_RUN_ID'/);
  assert.match(deploy, /capture-release-identity\.sh" "\$RELEASE_SHA" "\$BUILD_RUN_ID" "\$BUILD_RUN_ID"/);
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

test("visual review approval is bound to the exact candidate release", async () => {
  const finalizer = await read(paths.finalizer);
  assert.match(finalizer, /visualAcceptedSha === releaseSha/);
  assert.match(finalizer, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(finalizer, /visualAcceptanceReference/);
  assert.match(finalizer, /exact release SHA is required before UAT/);
});

test("customer certification covers auth denial, duplicate checkout, authoritative price, entitlements and full mobile payment", async () => {
  const customer = await read(paths.customer);
  assert.match(customer, /Unauthenticated checkout/);
  assert.match(customer, /Promise\.all/);
  assert.match(customer, /Duplicate checkout requests created different order IDs/);
  assert.match(customer, /amount_minor/);
  assert.match(customer, /paidOrder\.status !== "succeeded"/);
  assert.match(customer, /subscription-entitlements/);
  assert.match(customer, /x-jalwa-qa-token/);
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
  assert.match(media, /player\.locator\("video, iframe, img"\)/);
  assert.match(media, /providerHostedBoundary/);
  assert.match(visual, /VISUAL REVIEW REQUIRED/);
  assert.match(visual, /CI did not update the human-approved baseline manifest/);
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.schema_version, 1);
  assert.deepEqual(manifest.baselines, {});
});

test("visual certification validates every configured route before accepting review", async () => {
  const visual = await read(paths.visual);
  assert.doesNotMatch(visual, /pageFiles\[0\]/);
  assert.match(visual, /for \(const \[name, route\] of routes\)/);
  assert.match(visual, /manifest\.baselines\?\.\[name\]\?\.sha256/);
  assert.match(visual, /captures\.filter/);
  assert.match(visual, /VISUAL REVIEW REQUIRED/);
  assert.match(visual, /CI did not update the human-approved baseline manifest/);
});

test("reusable staging Playwright suite is syntactically valid and keeps sensitive recording disabled", async () => {
  const playwrightFiles = [
    paths.playwrightConfig,
    paths.playwrightHelper,
    paths.playwrightPublic,
    paths.playwrightAuth,
    paths.playwrightResponsive,
    paths.playwrightCustomer,
    paths.playwrightStudio,
    paths.playwrightMedia,
    paths.playwrightVisual,
    paths.mediaFixturePreflight,
  ];
  for (const relative of playwrightFiles) {
    execFileSync(process.execPath, ["--check", fileURLToPath(urlFor(relative))], { cwd: root, stdio: "pipe" });
  }
  const config = await read(paths.playwrightConfig);
  assert.match(config, /workers: 1/);
  assert.match(config, /trace: "off"/);
  assert.match(config, /video: "off"/);
  assert.match(config, /screenshot: "only-on-failure"/);
});

test("staging workflow directly invokes the reusable Playwright suites", async () => {
  const workflow = await read(paths.certify);
  assert.match(workflow, /npm run test:staging:playwright:public/);
  assert.match(workflow, /npm run test:staging:playwright:customer/);
  assert.match(workflow, /npm run test:staging:playwright:studio/);
  assert.match(workflow, /npm run test:staging:playwright:media/);
  assert.match(workflow, /PLAYWRIGHT_HTML_REPORT/);
  assert.match(workflow, /staging-media-fixture-preflight\.mjs/);
  assert.doesNotMatch(workflow, /node scripts\/staging-customer-certification\.mjs/);
  assert.doesNotMatch(workflow, /node scripts\/staging-studio-certification\.mjs/);
  assert.doesNotMatch(workflow, /node scripts\/staging-media-certification\.mjs/);
  assert.match(workflow, /staging-visual-certification\.mjs/);
});

test("Playwright public suite covers release identity, auth request and required mobile widths", async () => {
  const [publicSpec, auth, responsive] = await Promise.all([
    read(paths.playwrightPublic),
    read(paths.playwrightAuth),
    read(paths.playwrightResponsive),
  ]);
  assert.match(publicSpec, /expectedReleaseSha/);
  assert.match(publicSpec, /noindex/);
  assert.match(auth, /Check your email for the sign-in link/);
  assert.match(auth, /authenticatePage/);
  assert.match(responsive, /\[360, 390\]/);
  assert.match(responsive, /expectNoHorizontalOverflow/);
});

test("Playwright customer suite covers authentication, checkout, payment, subscription and mobile purchase", async () => {
  const customer = await read(paths.playwrightCustomer);
  assert.match(customer, /anonymous checkout is denied/);
  assert.match(customer, /Promise\.all/);
  assert.match(customer, /AUTO-QA-/);
  assert.match(customer, /succeeded/);
  assert.match(customer, /expectSubscriptionAndEntitlements/);
  assert.match(customer, /Pixel 7/);
});

test("Playwright Studio suite covers admin, rights review, finance, export audit and non-staff denial", async () => {
  const studio = await read(paths.playwrightStudio);
  assert.match(studio, /"admin"/);
  assert.match(studio, /"rights_reviewer"/);
  assert.match(studio, /"viewer"/);
  assert.match(studio, /"finance"/);
  assert.match(studio, /audit-export/);
  assert.match(studio, /x-jalwa-report-sha256/);
  assert.match(studio, /Permission denied/);
});

test("Playwright media and visual suites preserve governed live and human-review boundaries", async () => {
  const [media, visual] = await Promise.all([read(paths.playwrightMedia), read(paths.playwrightVisual)]);
  assert.match(media, /rights-approved published staging item/);
  assert.match(media, /official-link-only/);
  assert.match(media, /toHaveCount\(0\)/);
  assert.match(media, /JALWA_EXPECT_LIVE_SOURCES/);
  assert.match(visual, /VISUAL REVIEW REQUIRED/);
  assert.match(visual, /human-approved baseline/);
  assert.doesNotMatch(visual, /writeFile/);
});
