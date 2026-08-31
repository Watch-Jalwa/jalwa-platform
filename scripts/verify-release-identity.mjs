#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [identityPath, expectedSha, expectedPipeline] = process.argv.slice(2);
if (!identityPath || !/^[0-9a-f]{40}$/.test(expectedSha ?? "") || !/^\d+$/.test(expectedPipeline ?? "")) {
  console.error("usage: verify-release-identity.mjs <identity.json> <sha> <pipeline-id>");
  process.exit(2);
}

const identity = JSON.parse(await readFile(identityPath, "utf8"));
const failures = [];
if (identity.expected_source_sha !== expectedSha) failures.push("captured source SHA differs from expected release");
if (String(identity.deployment_pipeline_id) !== expectedPipeline) failures.push("captured pipeline ID differs from deployment run");

for (const service of ["web", "worker"]) {
  const item = identity.services?.[service];
  if (!item) {
    failures.push(`${service} identity is missing`);
    continue;
  }
  if (item.oci_revision !== expectedSha) failures.push(`${service} OCI revision mismatch`);
  if (String(item.build_run_id) !== expectedPipeline) failures.push(`${service} build-run label mismatch`);
  if (!/^sha256:[0-9a-f]{64}$/.test(item.image_id ?? "")) failures.push(`${service} immutable image ID is invalid`);
  if (!new RegExp(`^ghcr\\.io/watch-jalwa/jalwa-platform-${service}@sha256:[0-9a-f]{64}$`).test(item.repo_digest ?? "")) {
    failures.push(`${service} immutable registry digest is missing or invalid`);
  }
}

if (failures.length) {
  console.error(failures.join("; "));
  process.exit(1);
}

console.log(JSON.stringify({
  expected_source_sha: expectedSha,
  deployment_pipeline_id: expectedPipeline,
  web_digest: identity.services.web.repo_digest,
  worker_digest: identity.services.worker.repo_digest,
  rollback_release: identity.rollback_release ?? null,
}));
