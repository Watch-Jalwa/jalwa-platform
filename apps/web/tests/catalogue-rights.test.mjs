import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../../../supabase/migrations/202607300002_catalogue_rights.sql", import.meta.url), "utf8");

test("publishing requires an approved rights record", () => {
  assert.match(migration, /approved rights record required before publishing/);
  assert.match(migration, /status='approved'/);
});

test("YouTube ingestion creates an embed-only draft", () => {
  assert.match(migration, /'video','embed_only','public','draft'/);
  assert.match(migration, /youtube-nocookie\.com\/embed/);
});
