#!/usr/bin/env bash
set -Eeuo pipefail

initial="supabase/migrations/202608010002_approved_public_domain_live_inventory.sql"
institutional="supabase/migrations/202608010003_institutional_public_affairs_live_sources.sql"
open_government="supabase/migrations/202608010004_open_government_live_expansion.sql"
manifest="supabase/migrations/202608010005_approved_live_catalogue_manifest.sql"
state="scripts/set-public-domain-live-catalogue-state.sql"
seed="scripts/seed-public-domain-live-sources.sql"
workflow=".github/workflows/set-public-domain-live-sources.yml"

for file in "$initial" "$institutional" "$open_government" "$manifest" "$state" "$seed" "$workflow"; do
  [[ -s "$file" ]] || { echo "Missing required rights-readiness file: $file" >&2; exit 1; }
done

grep -q "'public_domain_live_image','self_host_open'" "$initial"
grep -q "'official_live_embed','embed_only'" "$initial"
grep -q "v_items <> 15" "$initial"
grep -q "v_links <> 6" "$institutional"
grep -q "UNITED_NATIONS_OFFICIAL_LINK_ONLY" "$institutional"
grep -q "v_items <> 31" "$open_government"
grep -q "v_images <> 15" "$open_government"
grep -q "v_links <> 16" "$open_government"
grep -q "embedding_confirmed=false" "$open_government"
grep -q "v_total <> 52" "$manifest"
grep -q "v_direct <> 44" "$manifest"

grep -q "approved_live_catalogue_manifest" "$state"
grep -q "v_expected <> 52" "$state"
grep -q "set enabled=true" "$state"
grep -q "set status='published'" "$state"
grep -q "set status='unavailable'" "$state"
grep -q "next_review_at > now()" "$state"

if grep -Eiq '\binsert[[:space:]]+into\b|\bupdate[[:space:]]+public\.|\bdelete[[:space:]]+from\b' "$seed"; then
  echo "Compatibility seed must not mutate approved inventory." >&2
  exit 1
fi
grep -q "v_manifest <> 52" "$seed"
grep -q "'user_facing_entries',46" "$seed"
grep -q "'current_image_entries',23" "$seed"
grep -q "'official_link_entries',22" "$seed"

grep -q "set-public-domain-live-catalogue-state.sql" "$workflow"
grep -q "set_database_state true" "$workflow"
grep -q "set_database_state false" "$workflow"
grep -q "Roll back failed enablement" "$workflow"
grep -q "Underlying approved items: 52" "$workflow"
grep -q "User-facing inventory: 46" "$workflow"
grep -q "2026-10-30T09:51:00Z" "$workflow"

echo "Approved live rights readiness contract passed."
