begin;

drop policy if exists "catalogue public" on public.content_items;
create policy "catalogue public" on public.content_items for select using(
  public.is_staff()
  or (
    status='published'
    and (
      publish_at is null
      or publish_at<=now()
      or (
        publish_at>now()
        and access_level='premium'
        and public.has_active_benefit('early_access')
      )
    )
    and (unpublish_at is null or unpublish_at>now())
  )
);

drop policy if exists "playback public" on public.playback_sources;
create policy "playback public" on public.playback_sources for select using(
  public.is_staff()
  or exists(
    select 1 from public.content_items c
    where c.id=content_id
      and c.status='published'
      and (
        c.publish_at is null
        or c.publish_at<=now()
        or (
          c.publish_at>now()
          and c.access_level='premium'
          and public.has_active_benefit('early_access')
        )
      )
      and (c.unpublish_at is null or c.unpublish_at>now())
  )
);

drop policy if exists "collections public" on public.collections;
create policy "collections public" on public.collections for select using(
  public.is_staff()
  or (
    status='published'
    and (publish_at is null or publish_at<=now())
    and (
      access_level<>'premium'
      or public.has_active_benefit('premium_collections')
    )
  )
);

drop policy if exists "collection items public" on public.collection_items;
create policy "collection items public" on public.collection_items for select using(
  public.is_staff()
  or exists(
    select 1 from public.collections c
    where c.id=collection_id
      and c.status='published'
      and (c.publish_at is null or c.publish_at<=now())
      and (
        c.access_level<>'premium'
        or public.has_active_benefit('premium_collections')
      )
  )
);

create or replace function public.is_content_effectively_available_for_viewer(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    public.is_content_effectively_available(p_content_id)
    or (
      public.has_internal_alpha_access()
      and public.has_active_benefit('early_access')
      and exists(
        select 1
        from public.content_items c
        left join public.source_accounts s on s.id=c.source_account_id
        where c.id=p_content_id
          and c.status='published'
          and c.access_level='premium'
          and c.publish_at>now()
          and (c.unpublish_at is null or c.unpublish_at>now())
          and c.is_available
          and c.disabled_at is null
          and (c.source_account_id is null or (
            s.is_enabled
            and s.approved_for_discovery
            and s.copyright_approved
            and s.disabled_at is null
          ))
          and public.has_publishable_rights(c.id,c.hosting_mode,c.access_level)
          and not exists(
            select 1 from public.rights_records r
            where r.content_id=c.id and r.rights_hold
          )
          and (
            c.hosting_mode='text_database'
            or exists(
              select 1
              from public.playback_sources p
              where p.content_id=c.id
                and p.is_primary
                and p.status='active'
                and p.is_available
                and p.disabled_at is null
                and (
                  c.hosting_mode not in ('self_host_open','self_host_owned')
                  or exists(
                    select 1
                    from public.media_assets a
                    where a.id=p.media_asset_id
                      and a.status='ready'
                      and a.is_available
                      and a.disabled_at is null
                  )
                )
            )
          )
      )
    )
$$;

grant execute on function public.is_content_effectively_available_for_viewer(uuid) to anon,authenticated;

commit;
