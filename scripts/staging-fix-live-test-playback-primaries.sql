-- Staging-only: demote draft Wikimedia/external playback rows that were
-- re-promoted to is_primary by idempotent live-test draft re-import after media encode.
begin;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

update public.playback_sources draft
set is_primary = false
where draft.is_primary = true
  and draft.media_asset_id is null
  and exists (
    select 1
    from public.playback_sources ready
    where ready.content_id = draft.content_id
      and ready.media_asset_id is not null
      and ready.status = 'active'
  );

update public.playback_sources ready
set is_primary = true,
    is_available = true
where ready.media_asset_id is not null
  and ready.status = 'active'
  and exists (
    select 1 from public.media_assets a
    where a.id = ready.media_asset_id and a.status = 'ready'
  )
  and not exists (
    select 1 from public.playback_sources p
    where p.content_id = ready.content_id and p.is_primary = true
  );

select json_build_object(
  'multi_primary_remaining', (
    select count(*) from (
      select content_id from public.playback_sources
      where is_primary = true
      group by content_id having count(*) > 1
    ) t
  ),
  'live_test_ready_primary', (
    select count(*) from public.playback_sources p
    join public.content_items ci on ci.id = p.content_id
    join public.media_assets a on a.id = p.media_asset_id
    where p.is_primary = true and a.status = 'ready'
      and ci.slug in (
        'mossy-tree-cc0','baking-cookies-cc0','ocean-surface-waves-cc0','tiny-waterfall-cc0',
        'tree-trimmer-cc0','counting-chisenbop-cc0','vanellus-vanellus-cc0'
      )
  )
);

commit;
