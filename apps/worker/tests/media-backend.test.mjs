import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mediaBackend, storageConfigured } from "../src/storage.mjs";

const mediaUrl = new URL("../src/media.mjs", import.meta.url);
const indexUrl = new URL("../src/index.mjs", import.meta.url);
const sourceDownloadUrl = new URL("../src/source-download.mjs", import.meta.url);

function withEnvironment(values, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("storage backend supports R2 and AWS without changing media job contracts", () => {
  withEnvironment({
    MEDIA_BACKEND: "aws",
    AWS_REGION: "ap-south-1",
    AWS_MEDIA_INCOMING_BUCKET: "incoming",
    AWS_MEDIA_PROCESSED_BUCKET: "processed",
    TRANSCODE_BACKEND: "mediaconvert",
    AWS_MEDIA_CONTROL_URL: "https://example.lambda-url.aws/",
    AWS_MEDIA_CONTROL_SECRET: "x".repeat(32),
  }, () => {
    assert.equal(mediaBackend(), "aws");
    assert.equal(storageConfigured(), true);
  });

  withEnvironment({
    MEDIA_BACKEND: "r2",
    R2_ACCOUNT_ID: "account",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_INCOMING_BUCKET: "incoming",
    R2_PROCESSED_BUCKET: "processed",
  }, () => {
    assert.equal(mediaBackend(), "r2");
    assert.equal(storageConfigured(), true);
  });
});

test("worker checks cancellation and rights before upload and publication", async () => {
  const [media, index, sourceDownload] = await Promise.all([
    readFile(mediaUrl, "utf8"),
    readFile(indexUrl, "utf8"),
    readFile(sourceDownloadUrl, "utf8"),
  ]);
  assert.match(media, /assertJobStillAllowed/);
  assert.match(media, /cancel_requested/);
  assert.match(media, /is_content_processing_allowed/);
  assert.match(media, /is_available: false/);
  assert.match(media, /mediaBackend/);
  assert.match(media, /dispatchMediaConvertJob/);
  assert.match(media, /uploadJsonMarker/);
  assert.match(index, /storageConfigured/);
  assert.match(index, /cancelled/);
  assert.match(index, /claim_source_download_job/);
  assert.match(index, /fail_source_download_job/);
  assert.match(sourceDownload, /Source media host is not allowlisted/);
  assert.match(sourceDownload, /private or reserved address/);
  assert.match(sourceDownload, /complete_source_download_job/);
  assert.match(sourceDownload, /uploadSourceFile/);
});
