#!/usr/bin/env bash
# Staging/demo-only, exact two orphaned media jobs. No R2 object mutation or rights/publication changes.
set -Eeuo pipefail
for name in jalwa-web-staging jalwa-worker-staging jalwa-postgres-staging; do
  test "$(docker inspect -f '{{.State.Running}}' "$name")" = true
done
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-worker-staging)" = healthy
disk_available="$(df -P / | awk 'NR==2 {print $4}')"
test "$disk_available" -ge 8388608
processes="$(docker top jalwa-worker-staging -eo pid,etime,comm)"
printf '%s\n' "$processes"
if printf '%s\n' "$processes" | grep -Eq '[[:space:]]ffmpeg([[:space:]]|$)'; then
  echo "ABORT: FFmpeg is active in worker container. No orphan cleanup allowed." >&2
  exit 2
fi
cat <<'SQL' | docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -t -v ON_ERROR_STOP=1 -P pager=off -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"'
BEGIN;
CREATE TEMP TABLE jalwa_stale_two ON COMMIT DROP AS
SELECT j.id job_id, j.media_asset_id asset_id, c.id content_id,
       c.slug, j.locked_at
FROM public.media_jobs j
JOIN public.media_assets a ON a.id=j.media_asset_id
JOIN public.content_items c ON c.id=a.content_id
WHERE c.slug IN ('sintel','vhs-static-cc0-clip')
  AND j.status='processing' AND a.status='processing'
  AND j.locked_by='worker-7' AND j.locked_at < now() - interval '30 minutes'
ORDER BY c.slug;
DO $guard$
BEGIN
  IF (SELECT count(*) FROM jalwa_stale_two) <> 2
    OR (SELECT count(DISTINCT slug) FROM jalwa_stale_two) <> 2 THEN
    RAISE EXCEPTION 'Stale Jalwa job gate failed: both exact old worker-7 jobs not present';
  END IF;
END $guard$;
UPDATE public.media_jobs
SET status='failed', locked_at=null, locked_by=null,
    error_message='Orphaned on prior worker-7 session; owner-authorized demo recovery 2026-11-05. Original R2 source preserved.'
WHERE id IN (SELECT job_id FROM jalwa_stale_two);
UPDATE public.media_assets
SET status='failed', is_available=false, disabled_reason='stale_worker_lock_reconciled_20261105'
WHERE id IN (SELECT asset_id FROM jalwa_stale_two);
INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
SELECT null,'stale_media_job_reconciled','content_item',content_id,
 jsonb_build_object('slug',slug,'scope','existing_demo','jobId',job_id,
   'sourcePreserved',true,'oldLockAt',locked_at,
   'reason','worker-7 no longer running; no active FFmpeg')
FROM jalwa_stale_two;
SELECT 'STALE_RECONCILED '||jsonb_build_object('slug',s.slug,
  'jobStatus',j.status::text,'assetStatus',a.status::text,
  'sourcePreserved',a.storage_key IS NOT NULL)::text
FROM jalwa_stale_two s
JOIN public.media_jobs j ON j.id=s.job_id
JOIN public.media_assets a ON a.id=s.asset_id;
COMMIT;
SQL
