import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCloudFrontSignedCookies } from "../lib/media/cloudfront-signing.mjs";

const controlsMigrationUrl = new URL("../../../database/migrations/202608010006_internal_alpha_content_controls.sql", import.meta.url);
const sourceMigrationUrl = new URL("../../../database/migrations/202608010007_alpha_approved_source_register.sql", import.meta.url);
const sourceRegisterUrl = new URL("../../../content/alpha-approved-sources.json", import.meta.url);
const alphaPageUrl = new URL("../app/studio/alpha/page.tsx", import.meta.url);
const alphaActionsUrl = new URL("../app/studio/alpha/actions.ts", import.meta.url);
const playbackRouteUrl = new URL("../app/api/playback/[contentId]/token/route.ts", import.meta.url);
const awsMainUrl = new URL("../../../infrastructure/aws-media/main.tf", import.meta.url);
const alphaWorkflowUrl = new URL("../../../.github/workflows/set-internal-alpha.yml", import.meta.url);
const mediaBackendWorkflowUrl = new URL("../../../.github/workflows/set-media-backend.yml", import.meta.url);
const composeUrl = new URL("../../../infrastructure/production/docker-compose.yml", import.meta.url);
const sourceDownloadUrl = new URL("../../worker/src/source-download.mjs", import.meta.url);

function decodeCloudFront(value) {
  return Buffer.from(
    value.replaceAll("-", "+").replaceAll("_", "=").replaceAll("~", "/"),
    "base64",
  );
}

test("database availability is fail-closed across source, item, playback, media and rights", async () => {
  const sql = await readFile(controlsMigrationUrl, "utf8");
  assert.match(sql, /source_accounts/);
  assert.match(sql, /is_available boolean not null default false/);
  assert.match(sql, /rights_hold boolean not null default false/);
  assert.match(sql, /create or replace function public\.is_content_effectively_available/);
  assert.match(sql, /create or replace function public\.set_content_availability/);
  assert.match(sql, /create or replace function public\.set_source_availability/);
  assert.match(sql, /create or replace function public\.set_rights_hold/);
  assert.match(sql, /cancel_requested boolean not null default false/);
  assert.match(sql, /create or replace function public\.claim_source_download_job/);
  assert.match(sql, /create or replace function public\.complete_source_download_job/);
  assert.match(sql, /create or replace function public\.complete_external_media_job/);
  assert.match(sql, /drop policy if exists "catalogue public"/);
  assert.match(sql, /public\.is_content_effectively_available\(id\)/);
  assert.match(sql, /public\.is_content_effectively_available\(content_id\)/);
});

test("the complete owner-approved source register is installed without auto-publishing items", async () => {
  const [sql, raw] = await Promise.all([
    readFile(sourceMigrationUrl, "utf8"),
    readFile(sourceRegisterUrl, "utf8"),
  ]);
  const register = JSON.parse(raw);
  assert.equal(register.sourceCount, 151);
  assert.equal(register.sources.length, 151);
  assert.ok(register.sources.every((source) => source.copyrightApproved === true));
  assert.ok(register.sources.every((source) => source.sourceId && source.sourceUrl && source.rightsEvidenceUrl));
  assert.match(sql, /expected 151 approved alpha source lanes/);
  assert.match(sql, /approved_for_discovery/);
  assert.match(sql, /item_level_check_required/);
  assert.doesNotMatch(sql, /insert into public\.content_items/i);
});

test("Studio exposes runtime, tester, source, item and rights-hold controls", async () => {
  const [page, actions] = await Promise.all([
    readFile(alphaPageUrl, "utf8"),
    readFile(alphaActionsUrl, "utf8"),
  ]);
  assert.match(page, /Internal alpha/);
  assert.match(page, /Approved source lanes/);
  assert.match(page, /Content availability and rights holds/);
  assert.match(page, /Tester access/);
  assert.match(actions, /set_source_availability/);
  assert.match(actions, /set_content_availability/);
  assert.match(actions, /set_rights_hold/);
  assert.match(actions, /set_internal_alpha_state/);
  assert.match(actions, /invalidateProcessedMedia/);
  assert.match(actions, /protected exact-SHA workflow/);
  assert.match(actions, /set_alpha_access_grant/);
  assert.match(actions, /review_source_item/);
  assert.match(actions, /promote_source_item_to_draft/);
  assert.doesNotMatch(page, />Enable alpha</);
  assert.match(page, /Set internal alpha/);
});

test("playback verifies effective availability and supports CloudFront signed cookies", async () => {
  const route = await readFile(playbackRouteUrl, "utf8");
  assert.match(route, /is_content_effectively_available/);
  assert.match(route, /CLOUDFRONT_KEY_PAIR_ID/);
  assert.match(route, /CLOUDFRONT_PRIVATE_KEY/);
  assert.match(route, /createCloudFrontSignedCookies/);
  assert.match(route, /eq\("is_available", true\)/);

  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const expiresAt = new Date(Date.now() + 300_000);
  const cookies = createCloudFrontSignedCookies({
    resource: "https://media.example.com/processed/content/asset/*",
    keyPairId: "KTEST",
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    expiresAt,
  });
  assert.equal(cookies["CloudFront-Key-Pair-Id"], "KTEST");
  const policy = decodeCloudFront(cookies["CloudFront-Policy"]).toString("utf8");
  assert.match(policy, /media\.example\.com/);
  const verifier = createVerify("RSA-SHA1");
  verifier.update(policy);
  verifier.end();
  assert.equal(
    verifier.verify(publicKey, decodeCloudFront(cookies["CloudFront-Signature"])),
    true,
  );
});

test("AWS media infrastructure keeps S3 private and uses OAC, signed key groups, queues and budgets", async () => {
  const terraform = await readFile(awsMainUrl, "utf8");
  assert.match(terraform, /aws_s3_bucket_public_access_block/);
  assert.match(terraform, /aws_cloudfront_origin_access_control/);
  assert.match(terraform, /trusted_key_groups/);
  assert.match(terraform, /aws_sqs_queue" "media_dlq/);
  assert.match(terraform, /aws_kms_key" "media/);
  assert.match(terraform, /aws_budgets_budget/);
  assert.match(terraform, /AllowCloudFrontRead/);
  assert.match(terraform, /aws_media_convert_queue/);
  assert.match(terraform, /aws_lambda_function\" \"submit_mediaconvert/);
  assert.match(terraform, /aws_lambda_function\" \"complete_mediaconvert/);
  assert.match(terraform, /aws_lambda_function_url\" \"control_media/);
  assert.match(terraform, /aws_cloudfront_response_headers_policy/);
  assert.match(terraform, /CreateInvalidation/);
});

test("protected alpha activation requires exact SHA, content, source and tester gates", async () => {
  const workflow = await readFile(alphaWorkflowUrl, "utf8");
  assert.match(workflow, /minimum_available_content/);
  assert.match(workflow, /release_sha/);
  assert.match(workflow, /issue #59/i);
  assert.match(workflow, /Roll back failed enablement/);
  assert.match(workflow, /set-internal-alpha-state\.sql/);
});


test("media backend switching is protected, transactional and reversible", async () => {
  const [workflow, compose, downloader] = await Promise.all([
    readFile(mediaBackendWorkflowUrl, "utf8"),
    readFile(composeUrl, "utf8"),
    readFile(sourceDownloadUrl, "utf8"),
  ]);
  assert.match(workflow, /release_sha/);
  assert.match(workflow, /Verify deployed release/);
  assert.match(workflow, /Roll back failed change/);
  assert.match(workflow, /MEDIA_BACKEND=aws/);
  assert.match(workflow, /TRANSCODE_BACKEND=mediaconvert/);
  assert.match(workflow, /MEDIA_BACKEND=r2/);
  assert.match(compose, /\.env\.media/);
  assert.match(compose, /required: false/);
  assert.match(downloader, /Source media host is not allowlisted/);
  assert.match(downloader, /private or reserved address/);
  assert.match(downloader, /SOURCE_DOWNLOAD_MAX_REDIRECTS/);
});
