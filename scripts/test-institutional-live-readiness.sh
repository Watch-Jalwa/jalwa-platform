#!/usr/bin/env bash
set -Eeuo pipefail

migration="supabase/migrations/202608010003_institutional_public_affairs_live_sources.sql"
registry="apps/web/lib/live-sources/registry.ts"
player="apps/web/components/official-live-link-player.tsx"
state="scripts/set-public-domain-live-catalogue-state.sql"
acceptance="scripts/public-domain-live-acceptance.mjs"

for file in "$migration" "$registry" "$player" "$state" "$acceptance"; do
  [[ -s "$file" ]] || { echo "Missing institutional live contract file: $file" >&2; exit 1; }
done

grep -Fq 'official_live_link' "$migration"
grep -Fq 'UNITED_NATIONS_OFFICIAL_LINK_ONLY' "$migration"
grep -Fq 'UN footage is not public domain' "$migration"
grep -Fq 'embedding_confirmed=false' "$migration"
grep -Fq 'european-parliament-plenary' "$registry"
grep -Fq 'un-human-rights-council' "$registry"
grep -Fq 'Open official live coverage' "$player"
! grep -Fq '<iframe' "$player"
grep -Fq 'v_ready <> 21' "$state"
grep -Fq "'user_facing_entries',15" "$state"
grep -Fq 'Expected at least thirteen active live watch links' "$acceptance"

echo "Institutional live readiness contract passed."
