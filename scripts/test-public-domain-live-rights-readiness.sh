#!/usr/bin/env bash
set -Eeuo pipefail

migration="supabase/migrations/202608010002_approved_public_domain_live_inventory.sql"
state="scripts/set-public-domain-live-catalogue-state.sql"
seed="scripts/seed-public-domain-live-sources.sql"
workflow=".github/workflows/set-public-domain-live-sources.yml"

for file in "$migration" "$state" "$seed" "$workflow"; do
  [[ -s "$file" ]] || { echo "Missing required rights-readiness file: $file" >&2; exit 1; }
done

grep -q "2026-08-01 09:51:00+00" "$migration"
grep -q "2026-10-30 09:51:00+00" "$migration"
grep -q "'public_domain_live_image','self_host_open'" "$migration"
grep -q "'official_live_embed','embed_only'" "$migration"
grep -q "'approved'" "$migration"
grep -q "false,'content-operations'" "$migration"
grep -q "v_items <> 15" "$migration"
grep -q "v_rights <> 15" "$migration"
grep -q "v_images <> 8" "$migration"

grep -q "v_ready <> 15" "$state"
grep -q "set enabled=true" "$state"
grep -q "set status='published'" "$state"
grep -q "set status='unavailable'" "$state"
grep -q "set status='draft'" "$state"
grep -q "next_review_at > now()" "$state"

grep -q "performs no inserts or updates" "$seed"
if grep -Eiq '\binsert[[:space:]]+into\b|\bupdate[[:space:]]+public\.|\bdelete[[:space:]]+from\b' "$seed"; then
  echo "Compatibility seed must not mutate approved inventory." >&2
  exit 1
fi

grep -q "set-public-domain-live-catalogue-state.sql" "$workflow"
grep -q "set_database_state true" "$workflow"
grep -q "set_database_state false" "$workflow"
grep -q "Roll back failed enablement" "$workflow"
grep -q "2026-10-30T09:51:00Z" "$workflow"

echo "Public-domain live rights readiness contract passed."
