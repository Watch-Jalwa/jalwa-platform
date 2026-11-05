#!/usr/bin/env bash
# Exact-title, rights-aware recovery of an interrupted demo FFmpeg lock.
# No source deletion, broad job reset, payment change, or rights change.
set -Eeuo pipefail
slug="${DEMO_14_RECOVER_SLUG:?}"
case "$slug" in
  grca-south-rim-winter-scenic|caminandes-llamigos|spring-blender|sprite-fright|cosmos-laundromat|apollo-11-eagle-has-landed) ;;
  *) echo "RECOVERY_REFUSED disallowed_slug" >&2; exit 2 ;;
esac
for ctr in jalwa-web-staging jalwa-worker-staging jalwa-postgres-staging; do
  test "$(docker inspect -f '{{.State.Running}}' "$ctr")" = true
done
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-worker-staging)" = healthy
test "$(docker inspect -f '{{.State.Health.Status}}' jalwa-web-staging)" = healthy
test "$(df -P / | awk 'NR==2 {print $4}')" -gt 6291456
docker exec jalwa-worker-staging node -e 'const e=process.env;if(e.DEPLOYMENT_ENVIRONMENT!=="staging"||e.MEDIA_BACKEND!=="r2"||e.PAYMENT_PROVIDER!=="mock")process.exit(1);console.log("DEMO_14_BOUNDARY_OK")'
if docker top jalwa-worker-staging -eo pid,etime,comm | grep -Eq '(^|[[:space:]])ffmpeg([[:space:]]|$)'; then
  echo "RECOVERY_REFUSED active FFmpeg exists" >&2; exit 3
fi
cat <<'SQL' | docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -t -v ON_ERROR_STOP=1 -P pager=off -v target="$1" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' _ "$slug"
BEGIN;
CREATE TEMP TABLE target_scope ON COMMIT DROP AS
SELECT c.id,c.slug,c.status::text status
FROM public.content_items c WHERE c.slug=:'target';
CREATE TEMP TABLE target_job ON COMMIT DROP AS
SELECT c.id content_id,c.slug,a.id asset_id,a.status::text asset_status,
       a.storage_key,a.size_bytes,j.id job_id,j.status::text job_status,
       j.job_type::text job_type,j.attempts,j.max_attempts,j.locked_at
FROM public.content_items c
JOIN public.media_assets a ON a.content_id=c.id AND a.kind='source_video'
JOIN public.media_jobs j ON j.media_asset_id=a.id
WHERE c.slug=:'target'
  AND c.status='editorial_review'
  AND c.is_available=false
  AND c.hosting_mode='self_host_open'
  AND c.access_level='public'
  AND public.has_publishable_rights(c.id,c.hosting_mode,c.access_level)
  AND public.is_content_processing_allowed(c.id)
  AND a.status='processing'
  AND a.is_available=false
  AND a.storage_key LIKE 'incoming/%'
  AND a.size_bytes>1024 AND a.size_bytes<367001600
  AND j.status='processing'
  AND j.attempts>=1
  AND j.attempts<j.max_attempts
  AND j.locked_at<now()-interval '12 minutes'
  AND NOT EXISTS (SELECT 1 FROM public.playback_sources p
    WHERE p.content_id=c.id AND p.media_asset_id=a.id AND p.is_available)
ORDER BY j.created_at DESC;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM target_scope) <> 1 THEN
   RAISE EXCEPTION 'Requested content record absent; no mutation';
 END IF;
 IF (SELECT count(*) FROM target_job) = 0 THEN
   IF NOT EXISTS (
     SELECT 1 FROM target_scope c
     JOIN public.media_assets a ON a.content_id=c.id AND a.kind='source_video'
     JOIN public.media_jobs j ON j.media_asset_id=a.id
     WHERE (j.status IN ('queued','completed') OR a.status IN ('queued','ready'))
        AND NOT (j.status='processing' AND a.status='processing')
   ) THEN
     RAISE EXCEPTION 'No eligible stale job and no queued/ready asset; refuse to infer recovery';
   END IF;
 ELSIF (SELECT count(*) FROM target_job) <> 1 THEN
   RAISE EXCEPTION 'Multiple stale jobs; no mutation';
 END IF;
 IF EXISTS (SELECT 1 FROM target_job WHERE
   (slug='grca-south-rim-winter-scenic' AND (job_type<>'short_mp4' OR size_bytes<>1729591))
   OR (slug='caminandes-llamigos' AND job_type<>'hls')
   OR (slug IN ('spring-blender','sprite-fright','cosmos-laundromat') AND job_type<>'hls')
   OR (slug='apollo-11-eagle-has-landed' AND job_type NOT IN ('hls','short_mp4'))
 ) THEN
   RAISE EXCEPTION 'Unexpected source bytes/job type: no mutation';
 END IF;
END $guard$;
UPDATE public.media_jobs j
SET status='queued',locked_at=null,locked_by=null,available_at=now(),
    error_message=null,updated_at=now()
FROM target_job t WHERE j.id=t.job_id AND j.status='processing';
UPDATE public.media_assets a
SET status='queued',is_available=false,updated_at=now()
FROM target_job t WHERE a.id=t.asset_id AND a.status='processing';
INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
SELECT null,'demo_14_orphan_requeued','content_item',content_id,
jsonb_build_object('slug',slug,'assetId',asset_id,'jobId',job_id,'scope','existing_internal_demo',
 'sourcePreserved',true,'initialLockedAt',locked_at,'attempts',attempts)
FROM target_job;
SELECT 'DEMO_14_STALE_JOB_REQUEUED '||jsonb_build_object(
 'slug',t.slug,'asset',t.asset_id,'job',t.job_id,'sourcePreserved',true,
 'status',j.status::text,'assetStatus',a.status::text)::text
FROM target_job t
JOIN public.media_jobs j ON j.id=t.job_id
JOIN public.media_assets a ON a.id=t.asset_id;
SELECT 'DEMO_14_STALE_NOT_NEEDED '||jsonb_build_object(
 'slug',s.slug,'status',s.status)::text
FROM target_scope s WHERE NOT EXISTS(SELECT 1 FROM target_job);
COMMIT;
SQL
