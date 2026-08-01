#!/usr/bin/env bash
set -Eeuo pipefail

migration="supabase/migrations/202608010002_approved_public_domain_live_inventory.sql"
institutional_migration="supabase/migrations/202608010003_institutional_public_affairs_live_sources.sql"
state="scripts/set-public-domain-live-catalogue-state.sql"
seed="scripts/seed-public-domain-live-sources.sql"
workflow=".github/workflows/set-public-domain-live-sources.yml"

for file in "$migration" "$institutional_migration" "$state" "$seed" "$workflow"; do
  [[ -s "$file" ]] || { echo "Missing required rights-readiness file: $file" >&2; exit 1; }
done

# Preserve the original approved public-domain inventory contract.
grep -q "2026-08-01 09:51:00+00" "$migration"
grep -q "2026-10-30 09:51:00+00" "$migration"
grep -q "'public_domain_live_image','self_host_open'" "$migration"
grep -q "'official_live_embed','embed_only'" "$migration"
grep -q "'approved'" "$migration"
grep -q "false,'content-operations'" "$migration"
grep -q "v_items <> 15" "$migration"
grep -q "v_rights <> 15" "$migration"
grep -q "v_images <> 8" "$migration"

# The controlled state transaction now covers 21 underlying records, which
# represent 15 user-facing entries and two camera collections.
grep -q "v_ready <> 21" "$state"
grep -q "'user_facing_entries',15" "$state"
grep -q "set enabled=true" "$state"
grep -q "set status='published'" "$state"
grep -q "set status='unavailable'" "$state"
grep -q "set status='draft'" "$state"
grep -q "next_review_at > now()" "$state"

# Institutional entries are link-only until an explicit embed/licence reference
# is retained; the UN entries must never be silently upgraded to inline video.
grep -q "official_live_link" "$institutional_migration"
grep -q "UNITED_NATIONS_OFFICIAL_LINK_ONLY" "$institutional_migration"
grep -q "embedding_confirmed=false" "$institutional_migration"
grep -q "v_links <> 6" "$institutional_migration"

# The staging compatibility seed remains read-only.
if grep -Eiq '\binsert[[:space:]]+into\b|\bupdate[[:space:]]+public\.|\bdelete[[:space:]]+from\b' "$seed"; then
  echo "Compatibility seed must not mutate approved inventory." >&2
  exit 1
fi
grep -q "'user_facing_entries',15" "$seed"
grep -q "'content_items',21" "$seed"
grep -q "'official_link_entries',6" "$seed"

grep -q "set-public-domain-live-catalogue-state.sql" "$workflow"
grep -q "set_database_state true" "$workflow"
grep -q "set_database_state false" "$workflow"
grep -q "Roll back failed enablement" "$workflow"
grep -q "2026-10-30T09:51:00Z" "$workflow"

echo "Approved live rights readiness contract passed."
