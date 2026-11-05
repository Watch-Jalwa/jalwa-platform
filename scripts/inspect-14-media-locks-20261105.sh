#!/usr/bin/env bash
set -Eeuo pipefail
started="$(docker inspect -f '{{.State.StartedAt}}' jalwa-worker-staging)"
echo "DEMO_WORKER_STARTED_AT $started"
docker top jalwa-worker-staging -eo pid,etime,comm || true
cat <<'SQL' | docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -t -v ON_ERROR_STOP=1 -P pager=off -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"'
BEGIN TRANSACTION READ ONLY;
SELECT 'DEMO_14_PROCESS ' || jsonb_build_object(
 'slug',c.slug,'status',j.status::text,'assetStatus',a.status::text,
 'lockedBy',j.locked_by,'lockedAt',j.locked_at,'updatedAt',j.updated_at,
 'attempts',j.attempts,'sizeBytes',a.size_bytes,
 'staleMinutes',round((extract(epoch from (now()-j.locked_at))/60)::numeric,2),
 'jobId',j.id,'assetId',a.id
)::text FROM public.media_jobs j
JOIN public.media_assets a ON a.id=j.media_asset_id
JOIN public.content_items c ON c.id=a.content_id
WHERE c.slug IN (
 'grca-south-rim-winter-scenic','caminandes-llamigos','spring-blender',
 'sprite-fright','cosmos-laundromat','apollo-11-eagle-has-landed',
 'grca-animals-broll','artemis-ii-trajectory-svs')
ORDER BY j.created_at DESC LIMIT 15;
ROLLBACK;
SQL
