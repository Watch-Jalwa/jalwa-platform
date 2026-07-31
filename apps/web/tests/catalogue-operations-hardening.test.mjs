import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/202607310001_catalogue_rights_operations.sql", import.meta.url);
const actionsUrl = new URL("../app/studio/actions.ts", import.meta.url);
const detailPageUrl = new URL("../app/studio/content/[id]/page.tsx", import.meta.url);
const listPageUrl = new URL("../app/studio/content/page.tsx", import.meta.url);
const importerUrl = new URL("../../../scripts/import-launch-catalogue.mjs", import.meta.url);

test("database publication rules require complete current mode-compatible rights", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /evidence_url text/);
  assert.match(sql, /takedown_contact text/);
  assert.match(sql, /expires_at timestamptz/);
  assert.match(sql, /create or replace function public\.enforce_rights_approval/);
  assert.match(sql, /create or replace function public\.has_publishable_rights/);
  assert.match(sql, /embedding permission is required for embed-only content/);
  assert.match(sql, /self-hosting permission is required for self-hosted content/);
  assert.match(sql, /commercial-use permission is required for self-hosted or premium content/);
  assert.match(sql, /and public\.has_publishable_rights\(c\.id, c\.hosting_mode, c\.access_level\)/);
  assert.match(sql, /drop policy if exists "catalogue public"/);
  assert.match(sql, /drop policy if exists "playback public"/);
});

test("Studio records evidence and can immediately stop publication", async () => {
  const [actions, detailPage, listPage] = await Promise.all([
    readFile(actionsUrl, "utf8"),
    readFile(detailPageUrl, "utf8"),
    readFile(listPageUrl, "utf8"),
  ]);
  assert.match(actions, /export async function updateRightsAction/);
  assert.match(actions, /evidence_url:/);
  assert.match(actions, /takedown_contact:/);
  assert.match(actions, /export async function unpublishContentAction/);
  assert.doesNotMatch(actions, /status: "approved",\s*embedding_confirmed: true/);
  assert.match(detailPage, /Evidence URL/);
  assert.match(detailPage, /Takedown contact/);
  assert.match(detailPage, /Unpublish immediately/);
  assert.match(listPage, /Expired or expiring within 30 days/);
});

test("batch intake accepts CSV but preserves human-approved rights", async () => {
  const importer = await readFile(importerUrl, "utf8");
  assert.match(importer, /loadCatalogueFile/);
  assert.match(importer, /existingRights\[0\]\.status !== "approved"/);
  assert.match(importer, /preservedApprovedRights/);
  assert.match(importer, /takedown_contact/);
  assert.match(importer, /evidenceFields/);
});
