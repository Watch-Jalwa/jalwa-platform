#!/usr/bin/env bash
set -Eeuo pipefail
# Exact one original, title-specific fail-closed stale-job recovery.
# Never reset other films or alter approved rights, source objects, payments, or publication.
for container in jalwa-web-staging jalwa-worker-staging jalwa-postgres-staging; do
  test "$(docker inspect -f '{{.State.Running}}' "$container")" = true
done
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-worker-staging)" = healthy
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-web-staging)" = healthy
test "$(df -P / | awk 'NR==2 {print $4}')" -gt 8388608
docker exec jalwa-worker-staging node -e 'const e=process.env;if(e.DEPLOYMENT_ENVIRONMENT!=="staging"||e.MEDIA_BACKEND!=="r2"||e.PAYMENT_PROVIDER!=="mock")process.exit(1);console.log("SAFE_STAGING_MEDIA_RETRY")'
if docker top jalwa-worker-staging -eo pid,etime,comm | grep -Eq '(^|[[:space:]])ffmpeg([[:space:]]|$)'; then
  echo 'Refuse stale reset while FFmpeg is running' >&2
  exit 2
fi
cat <<'SQL' | docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -t -v ON_ERROR_STOP=1 -P pager=off -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"'
BEGIN;
CREATE TEMP TABLE chosen ON COMMIT DROP AS
SELECT j.id job_id,a.id asset_id,c.id content_id,c.slug,j.locked_at,
       j.attempts,a.storage_key
FROM public.media_jobs j
JOIN public.media_assets a ON a.id=j.media_asset_id
JOIN public.content_items c ON c.id=a.content_id
WHERE c.slug='artemis-ii-trajectory-svs'
  AND c.status='editorial_review'
  AND c.is_available=false
  AND c.content_type='short'
  AND c.hosting_mode='self_host_open'
  AND public.is_content_processing_allowed(c.id)
  AND public.has_publishable_rights(c.id,c.hosting_mode,c.access_level)
  AND j.status='processing'
  AND a.status='processing'
  AND a.kind='source_video'
  AND j.job_type='short_mp4'
  AND j.attempts=1
  AND j.max_attempts>=3
  AND j.locked_at<now()-interval '3 minutes'
  AND j.cancel_requested=false
  AND a.storage_key LIKE 'incoming/%'
  AND a.size_bytes=10294760
  AND a.is_available=false;
DO $$
BEGIN
  IF (SELECT count(*) FROM chosen) <> 1 THEN
     RAISE EXCEPTION 'Expected one exact interrupted Artemis II Trajectory short encode; no changes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.playback_sources p WHERE p.content_id=(SELECT content_id FROM chosen)
    AND p.media_asset_id=(SELECT asset_id FROM chosen) AND p.is_available) THEN
     RAISE EXCEPTION 'Unexpected publicly available playback; no changes';
  END IF;
END $$;
UPDATE public.media_jobs j SET status='queued',locked_at=null,locked_by=null,
  available_at=now(),error_message=null,updated_at=now()
FROM chosen c WHERE j.id=c.job_id AND j.status='processing';
UPDATE public.media_assets a SET status='queued',is_available=false,updated_at=now()
FROM chosen c WHERE a.id=c.asset_id AND a.status='processing';
INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
SELECT null,'demo_14_orphan_requeued','content_item',content_id,
  jsonb_build_object('slug',slug,'jobId',job_id,'assetId',asset_id,
   'reason','Interrupted worker; 3+ minute stale job and no active FFmpeg',
   'oldLockedAt',locked_at,'sourcePreserved',true,'scope','internal-demo-only')
FROM chosen;
SELECT 'ARTEMIS_JOB_RECOVERED '||jsonb_build_object(
 'slug',c.slug,'assetId',c.asset_id,'jobId',c.job_id,
 'newJobStatus',j.status::text,'newAssetStatus',a.status::text,
 'sourcePreserved',true,'attempts',j.attempts)::text
FROM chosen c
JOIN public.media_jobs j ON j.id=c.job_id
JOIN public.media_assets a ON a.id=c.asset_id;
COMMIT;
SQL
