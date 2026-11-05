#!/usr/bin/env bash
# Read-only Jalwa internal-demo inventory for exact 32 user-reported unavailable slugs.
set -Eeuo pipefail
cat <<'SQL' | docker exec -i jalwa-postgres-staging sh -lc 'exec psql -X -A -t -v ON_ERROR_STOP=1 -P pager=off -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"'
BEGIN TRANSACTION READ ONLY;
WITH wanted(slug,grp) AS (
 VALUES
 ('khyber-karma-dvids','HOLD'),('op-mustang-dvids','HOLD'),
 ('rawhide-ii-border-hub-dvids','HOLD'),('chauntra-village-spring','HOLD'),
 ('eastern-hindu-kush-lowari','HOLD'),('hunza-valley-wle-2018','HOLD'),
 ('indus-kotri-barrage','HOLD'),('earthrise-45th-svs','HOLD'),
 ('artemis-i-overview-svs','HOLD'),('artemis-science-lunar-flyby-svs','HOLD'),
 ('eso-vista-cosmos-zoom','HOLD'),('proxima-centauri-eso-medium','HOLD'),
 ('sintel','APPROVED'),('sprite-fright','APPROVED'),('tears-of-steel','APPROVED'),
 ('spring-blender','APPROVED'),('cosmos-laundromat','APPROVED'),
 ('caminandes-llamigos','APPROVED'),('vhs-static-cc0-clip','APPROVED'),
 ('house-sparrow-tschilp-cc0','APPROVED'),
 ('huamei-bird-calling-cc0','APPROVED'),
 ('abrasive-bird-debate-cc0','APPROVED'),
 ('artemis-ii-lunar-flyby-svs','APPROVED'),
 ('artemis-ii-trajectory-svs','APPROVED'),
 ('earth-views-from-iss-nasa','APPROVED'),
 ('hst-fly-by-nasa','APPROVED'),
 ('hd-earth-views-svs','APPROVED'),
 ('hst-sm4-rendezvous-nasa','APPROVED'),
 ('apollo-11-eagle-has-landed','APPROVED'),
 ('grca-south-rim-summer-timelapse','APPROVED'),
 ('grca-animals-broll','APPROVED'),
 ('grca-south-rim-winter-scenic','APPROVED')
)
SELECT 'JALWA_INVENTORY ' || jsonb_build_object(
 'slug',w.slug,'group',w.grp,'exists',c.id is not null,
 'contentStatus',c.status::text,
 'contentType',c.content_type::text,
 'hostingMode',c.hosting_mode::text,
 'availability',c.is_available,
 'publishAt',c.publish_at,
 'unpublishAt',c.unpublish_at,
 'disabledReason',c.disabled_reason,
 'rights', (
  SELECT jsonb_build_object('status',r.status::text,'hold',r.rights_hold,
     'holdReason',r.rights_hold_reason,'licence',r.licence_code,
     'selfHosting',r.self_hosting_confirmed,'commercial',r.commercial_use_confirmed,
     'modification',r.modification_confirmed,'embedding',r.embedding_confirmed,
     'evidencePresent',r.evidence_url IS NOT NULL OR r.evidence_note IS NOT NULL,
     'verifiedAt',r.verified_at,'expiresAt',r.expires_at,
     'sourceUrl',r.source_url)
  FROM public.rights_records r WHERE r.content_id=c.id
  ORDER BY CASE WHEN r.status::text='approved' THEN 0 ELSE 1 END,r.updated_at DESC LIMIT 1
 ),
 'assetCounts', (
  SELECT jsonb_build_object('total',count(*),
    'ready',count(*) FILTER (WHERE a.status::text='ready'),
    'inProgress',count(*) FILTER (WHERE a.status::text in ('queued','processing','pending_upload')),
    'sourceKeys',count(*) FILTER (WHERE a.storage_key IS NOT NULL AND a.storage_key<>''),
    'available',count(*) FILTER (WHERE a.is_available IS TRUE))
  FROM public.media_assets a WHERE a.content_id=c.id
 ),
 'recentAssets', (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('status',b.status::text,
    'kind',b.kind::text,'storageKeyPresent',b.storage_key IS NOT NULL,
    'bytes',b.size_bytes,'available',b.is_available,
    'createdAt',b.created_at,'disabledReason',b.disabled_reason)), '[]'::jsonb)
  FROM (SELECT a.status,a.kind,a.storage_key,a.size_bytes,a.is_available,
      a.created_at,a.disabled_reason
        FROM public.media_assets a WHERE a.content_id=c.id
        ORDER BY a.created_at DESC LIMIT 3) b
 ),
 'recentJobs', (
   SELECT COALESCE(jsonb_agg(jsonb_build_object('jobType',j.job_type::text,
     'status',j.status::text,'attempts',j.attempts,
     'error',left(coalesce(j.error_message,''),250),
     'completedAt',j.completed_at)), '[]'::jsonb)
   FROM (
    SELECT mj.job_type,mj.status,mj.attempts,mj.error_message,mj.completed_at
    FROM public.media_jobs mj JOIN public.media_assets ma ON ma.id=mj.media_asset_id
    WHERE ma.content_id=c.id ORDER BY mj.created_at DESC LIMIT 3
   ) j
 ),
 'primaryPlayback',(
  SELECT jsonb_build_object('provider',p.provider::text,
    'status',p.status::text,'available',p.is_available,
    'isPrimary',p.is_primary,
    'format',p.format::text,'hasMediaUrl',nullif(p.media_url,'') IS NOT NULL,
    'hasEmbedUrl',nullif(p.embed_url,'') IS NOT NULL,
    'hasExternalUrl',nullif(p.external_url,'') IS NOT NULL,
    'hasAssetId',p.media_asset_id IS NOT NULL)
  FROM public.playback_sources p WHERE p.content_id=c.id AND p.is_primary=true
  ORDER BY p.id LIMIT 1
 )
)::text
FROM wanted w LEFT JOIN public.content_items c ON c.slug=w.slug ORDER BY w.grp,w.slug;
ROLLBACK;
SQL
