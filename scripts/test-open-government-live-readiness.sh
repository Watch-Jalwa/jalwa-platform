#!/usr/bin/env bash
set -Eeuo pipefail

sources="apps/web/lib/live-sources/open-government-sources.js"
security="apps/web/lib/live-sources/security.ts"
migration="supabase/migrations/202608010004_open_government_live_expansion.sql"
manifest="supabase/migrations/202608010005_approved_live_catalogue_manifest.sql"
state="scripts/set-public-domain-live-catalogue-state.sql"
seed="scripts/seed-public-domain-live-sources.sql"
acceptance="scripts/public-domain-live-acceptance.mjs"

for file in "$sources" "$security" "$migration" "$manifest" "$state" "$seed" "$acceptance"; do
  [[ -s "$file" ]] || { echo "Missing open-government readiness file: $file" >&2; exit 1; }
done

grep -q 'npsRows.map(npsCamera)' "$sources"
grep -q 'linkRows.map(officialLink)' "$sources"
grep -q 'Object.assign(LIVE_SOURCE_REGISTRY' "$sources"
grep -q 'imagePathPattern' "$sources"
grep -q 'pathPattern.test(allowed.pathname)' "$security"
grep -q "v_items <> 31" "$migration"
grep -q "v_images <> 15" "$migration"
grep -q "v_links <> 16" "$migration"
grep -q "embedding_confirmed=false" "$migration"
grep -q "v_total <> 52" "$manifest"
grep -q "v_direct <> 44" "$manifest"
grep -q 'approved_live_catalogue_manifest' "$state"
grep -q "v_manifest <> 52" "$seed"
grep -q "'user_facing_entries',46" "$seed"
grep -q 'NPS Devils Tower Entrance' "$acceptance"
grep -q 'U.S. Senate Floor Webcast' "$acceptance"

if grep -Eiq 'Al Jazeera|\bPTV\b|Doordarshan|DD News|\bARY\b|Geo News' "$sources" "$migration"; then
  echo "Commercial broadcaster entered the open-government allowlist." >&2
  exit 1
fi

echo "Open-government live readiness contract passed."
