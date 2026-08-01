\set ON_ERROR_STOP on

select set_config('jalwa.deployment_environment', :'deployment_environment', false);
select set_config('jalwa.public_domain_live_desired_state', :'desired_state', false);

do $$
begin
  if current_setting('jalwa.deployment_environment', true) not in ('staging','production') then
    raise exception 'Public-domain live catalogue state may change only in staging or production';
  end if;
  if current_setting('jalwa.public_domain_live_desired_state', true) not in ('true','false') then
    raise exception 'Desired public-domain live catalogue state must be true or false';
  end if;
end $$;

begin;

create temporary table approved_live_state_inventory (
  source_key text primary key,
  slug text not null unique
);

insert into approved_live_state_inventory values
('nasa-space-station-views','nasa-space-station-views'),
('noaa-ocean-camera-1','noaa-ocean-exploration-camera-1'),
('noaa-ocean-camera-2','noaa-ocean-exploration-camera-2'),
('noaa-ocean-camera-3','noaa-ocean-exploration-camera-3'),
('usgs-kilauea-v1','usgs-kilauea-v1'),
('usgs-kilauea-v2','usgs-kilauea-v2'),
('usgs-kilauea-v3','usgs-kilauea-v3'),
('usgs-mauna-loa-mlcam','usgs-mauna-loa-mlcam'),
('usgs-mauna-loa-mtcam','usgs-mauna-loa-mtcam'),
('usgs-mauna-loa-mk2cam','usgs-mauna-loa-mk2cam'),
('usgs-mauna-loa-mkcam','usgs-mauna-loa-mkcam'),
('usgs-river-pequest','usgs-river-pequest'),
('usgs-river-delaware-belvidere','usgs-river-delaware-belvidere'),
('usgs-lake-hopatcong','usgs-lake-hopatcong'),
('usgs-river-rancocas','usgs-river-rancocas');

do $$
declare
  v_ready integer;
begin
  if current_setting('jalwa.public_domain_live_desired_state', true) = 'true' then
    select count(*) into v_ready
    from approved_live_state_inventory i
    join public.content_items c on c.slug=i.slug
    join public.playback_sources p on p.content_id=c.id and p.is_primary
    join public.live_source_configs l on l.playback_source_id=p.id and l.source_key=i.source_key
    where c.access_level='public'
      and l.rights_verified_at is not null
      and l.next_review_at > now()
      and exists (
        select 1 from public.rights_records r
        where r.content_id=c.id and r.status='approved'
          and (r.expires_at is null or r.expires_at > now())
      );

    if v_ready <> 15 then
      raise exception 'All 15 approved underlying live items require current rights and configuration before enablement; found %', v_ready;
    end if;

    update public.live_source_configs l
    set enabled=true
    from approved_live_state_inventory i
    where l.source_key=i.source_key;

    update public.content_items c
    set status='published',
        publish_at=coalesce(c.publish_at, now()),
        unpublish_at=null
    from approved_live_state_inventory i
    where c.slug=i.slug;

    update public.collections
    set status='published'
    where slug in ('usgs-mauna-loa-live','usgs-rivers-lakes-live');
  else
    update public.live_source_configs l
    set enabled=false
    from approved_live_state_inventory i
    where l.source_key=i.source_key;

    update public.content_items c
    set status='unavailable',
        unpublish_at=now()
    from approved_live_state_inventory i
    where c.slug=i.slug;

    update public.collections
    set status='draft'
    where slug in ('usgs-mauna-loa-live','usgs-rivers-lakes-live');
  end if;
end $$;

do $$
declare
  v_desired boolean := current_setting('jalwa.public_domain_live_desired_state', true)::boolean;
  v_configs integer;
  v_content integer;
  v_collections integer;
begin
  select count(*) into v_configs
  from public.live_source_configs l
  join approved_live_state_inventory i on i.source_key=l.source_key
  where l.enabled=v_desired;

  select count(*) into v_content
  from public.content_items c
  join approved_live_state_inventory i on i.slug=c.slug
  where (v_desired and c.status='published')
     or (not v_desired and c.status='unavailable');

  select count(*) into v_collections
  from public.collections
  where slug in ('usgs-mauna-loa-live','usgs-rivers-lakes-live')
    and ((v_desired and status='published') or (not v_desired and status='draft'));

  if v_configs <> 15 then raise exception 'Live source configuration state update was incomplete'; end if;
  if v_content <> 15 then raise exception 'Live content publication state update was incomplete'; end if;
  if v_collections <> 2 then raise exception 'Live collection state update was incomplete'; end if;
end $$;

commit;

select jsonb_build_object(
  'environment',current_setting('jalwa.deployment_environment', true),
  'enabled',current_setting('jalwa.public_domain_live_desired_state', true)::boolean,
  'source_configs',(select count(*) from public.live_source_configs l join approved_live_state_inventory i on i.source_key=l.source_key),
  'content_items',(select count(*) from public.content_items c join approved_live_state_inventory i on i.slug=c.slug),
  'collections',(select count(*) from public.collections where slug in ('usgs-mauna-loa-live','usgs-rivers-lakes-live'))
) as public_domain_live_catalogue_state;
