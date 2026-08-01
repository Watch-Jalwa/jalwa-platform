\set ON_ERROR_STOP on

select set_config('jalwa.deployment_environment', :'deployment_environment', false);
select set_config('jalwa.public_domain_live_desired_state', :'desired_state', false);

do $$
begin
  if current_setting('jalwa.deployment_environment', true) not in ('staging','production') then
    raise exception 'Approved live catalogue state may change only in staging or production';
  end if;
  if current_setting('jalwa.public_domain_live_desired_state', true) not in ('true','false') then
    raise exception 'Desired approved live catalogue state must be true or false';
  end if;
end $$;

begin;

create temporary table approved_live_state_inventory as
select source_key,slug,user_facing_entry
from public.approved_live_catalogue_manifest;

alter table approved_live_state_inventory add primary key(source_key);
create unique index on approved_live_state_inventory(slug);

do $$
declare
  v_ready integer;
  v_expected integer;
begin
  select count(*) into v_expected from approved_live_state_inventory;
  if v_expected <> 52 then raise exception 'Approved live manifest is incomplete; found %', v_expected; end if;

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

    if v_ready <> v_expected then
      raise exception 'All % approved underlying live items require current rights and configuration before enablement; found %', v_expected, v_ready;
    end if;

    update public.live_source_configs l
    set enabled=true
    from approved_live_state_inventory i
    where l.source_key=i.source_key;

    update public.content_items c
    set status='published', publish_at=coalesce(c.publish_at, now()), unpublish_at=null
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
    set status='unavailable', unpublish_at=now()
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
  v_expected integer;
  v_configs integer;
  v_content integer;
  v_collections integer;
begin
  select count(*) into v_expected from approved_live_state_inventory;
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

  if v_configs <> v_expected then raise exception 'Live source configuration state update was incomplete'; end if;
  if v_content <> v_expected then raise exception 'Live content publication state update was incomplete'; end if;
  if v_collections <> 2 then raise exception 'Live collection state update was incomplete'; end if;
end $$;

commit;

select jsonb_build_object(
  'environment',current_setting('jalwa.deployment_environment', true),
  'enabled',current_setting('jalwa.public_domain_live_desired_state', true)::boolean,
  'user_facing_entries',(select count(*) + 2 from approved_live_state_inventory where user_facing_entry),
  'source_configs',(select count(*) from public.live_source_configs l join approved_live_state_inventory i on i.source_key=l.source_key),
  'content_items',(select count(*) from public.content_items c join approved_live_state_inventory i on i.slug=c.slug),
  'collections',(select count(*) from public.collections where slug in ('usgs-mauna-loa-live','usgs-rivers-lakes-live'))
) as approved_live_catalogue_state;
