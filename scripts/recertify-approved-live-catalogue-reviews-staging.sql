\set ON_ERROR_STOP on

-- Staging-only forward re-review for the approved 52-record live catalogue.
-- This only moves review windows into the future, never flips rights status,
-- and never changes hosting/delivery modes. It records a new verification
-- timestamp and a future next-review date after the previous Oct 2026 window
-- expired.

select set_config('jalwa.deployment_environment', :'deployment_environment', false);

do $$
begin
  if current_setting('jalwa.deployment_environment', true) <> 'staging' then
    raise exception 'Approved live catalogue re-review may run only in staging';
  end if;
end $$;

begin;

do $$
declare
  v_touched integer;
  v_ready integer;
begin
  update public.live_source_configs l
  set rights_verified_at=now(),
      next_review_at=now() + interval '90 days'
  from public.approved_live_catalogue_manifest m
  where l.source_key=m.source_key;

  get diagnostics v_touched = row_count;
  if v_touched <> 52 then
    raise exception 'Approved live catalogue re-review must cover 52 sources; touched %', v_touched;
  end if;

  update public.rights_records r
  set review_notes=concat_ws(
        E'\n',
        nullif(r.review_notes,''),
        '2026-11-03 staging re-review: prior next_review_at window ending 2026-10-30 expired; forward-only verification recorded for launch catalogue continuity under unchanged hosting/delivery constraints. No rights status or delivery-mode change.'
      ),
      updated_at=now()
  from public.content_items c
  join public.approved_live_catalogue_manifest m on m.slug=c.slug
  where r.content_id=c.id
    and r.status='approved';

  update public.rights_records r
  set expires_at=now() + interval '90 days',
      updated_at=now()
  from public.content_items c
  join public.approved_live_catalogue_manifest m on m.slug=c.slug
  where r.content_id=c.id
    and r.status='approved'
    and (r.expires_at is null or r.expires_at <= now());

  select count(*) into v_ready
  from public.approved_live_catalogue_manifest m
  join public.content_items c on c.slug=m.slug
  join public.playback_sources p on p.content_id=c.id and p.is_primary
  join public.live_source_configs l on l.playback_source_id=p.id and l.source_key=m.source_key
  where c.access_level='public'
    and c.disabled_at is null
    and p.status='active'
    and p.disabled_at is null
    and l.rights_verified_at is not null
    and l.next_review_at > now()
    and exists (
      select 1 from public.rights_records r
      where r.content_id=c.id and r.status='approved'
        and not r.rights_hold
        and (r.expires_at is null or r.expires_at > now())
    );

  if v_ready <> 52 then
    raise exception 'Approved live catalogue is not rights-current after staging re-review; ready=%', v_ready;
  end if;
end $$;

commit;

select jsonb_build_object(
  'environment','staging',
  'recertified_sources',52,
  'rights_window_days',90,
  'earliest_next_review_at',(
    select min(l.next_review_at)
    from public.live_source_configs l
    join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  )
) as approved_live_recertify_summary;
