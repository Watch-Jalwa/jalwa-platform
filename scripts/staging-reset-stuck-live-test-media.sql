-- Staging-only: mark stuck processing media as failed so wave4 can re-ingest.
begin;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

with stuck as (
  update public.media_assets a
  set status = 'failed',
      disabled_reason = coalesce(disabled_reason, 'staging_wave_reset_stuck_processing'),
      updated_at = now()
  where a.status in ('processing', 'queued', 'pending_upload')
    and a.created_at < now() - interval '45 minutes'
    and exists (
      select 1 from public.content_items ci
      where ci.id = a.content_id
        and ci.slug in (
          'invitation-to-pakistan-nara','promise-of-pakistan-geography',
          'huamei-bird-calling-cc0','house-sparrow-tschilp-cc0','abrasive-bird-debate-cc0',
          'eso-cast-254-light','eso-cast-265-light',
          'sintel','elephants-dream','caminandes-llamigos','tears-of-steel',
          'sprite-fright','spring-blender','cosmos-laundromat',
          'vhs-static-cc0-clip'
        )
    )
  returning a.id, a.content_id, a.status
)
update public.media_jobs j
set status = 'failed',
    finished_at = coalesce(j.finished_at, now()),
    error = coalesce(j.error, 'reset by staging-reset-stuck-live-test-media.sql')
where j.media_asset_id in (select id from stuck)
  and j.status in ('queued', 'processing');

select json_build_object(
  'ready_unpublished', (
    select count(*) from content_items ci
    join media_assets a on a.content_id = ci.id and a.status = 'ready'
    where ci.status <> 'published'
      and ci.slug in (
        select slug from (values
          ('mossy-tree-cc0'),('baking-cookies-cc0'),('ocean-surface-waves-cc0'),('tiny-waterfall-cc0'),
          ('tree-trimmer-cc0'),('counting-chisenbop-cc0'),('vanellus-vanellus-cc0'),
          ('how-fossils-form-cc-by'),('proxima-centauri-flythrough-cc-by'),
          ('invitation-to-pakistan-nara'),('promise-of-pakistan-geography'),
          ('wikipedia-science-comms-cc-by'),('big-buck-bunny')
        ) s(slug)
      )
  )
);

commit;
