begin;

-- Public catalogue launch boundary.
-- Internal-alpha access remains available for private/operator surfaces, but it
-- must not gate content that has independently satisfied every publication,
-- rights, source, playback and availability requirement.
create or replace function public.is_content_effectively_available(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.content_items c
    left join public.source_accounts s on s.id = c.source_account_id
    where c.id = p_content_id
      and c.status = 'published'
      and c.is_available
      and c.disabled_at is null
      and (c.publish_at is null or c.publish_at <= now())
      and (c.unpublish_at is null or c.unpublish_at > now())
      and (
        c.source_account_id is null
        or (
          s.is_enabled
          and s.approved_for_discovery
          and s.copyright_approved
          and s.disabled_at is null
        )
      )
      and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
      and not exists(
        select 1
        from public.rights_records r
        where r.content_id = c.id
          and r.rights_hold
      )
      and (
        c.hosting_mode = 'text_database'
        or exists(
          select 1
          from public.playback_sources p
          where p.content_id = c.id
            and p.is_primary
            and p.status = 'active'
            and p.is_available
            and p.disabled_at is null
            and (
              c.hosting_mode not in ('self_host_open', 'self_host_owned')
              or exists(
                select 1
                from public.media_assets a
                where a.id = p.media_asset_id
                  and a.status = 'ready'
                  and a.is_available
                  and a.disabled_at is null
              )
            )
        )
      )
  )
$$;

-- A published collection is a public navigation object. Individual entries
-- remain fail-closed through is_content_effectively_available().
drop policy if exists "collections public" on public.collections;
create policy "collections public" on public.collections
for select using(
  public.is_staff()
  or status = 'published'
);

drop policy if exists "collection items public" on public.collection_items;
create policy "collection items public" on public.collection_items
for select using(
  public.is_staff()
  or (
    exists(
      select 1
      from public.collections c
      where c.id = collection_id
        and c.status = 'published'
    )
    and public.is_content_effectively_available(content_id)
  )
);

comment on function public.is_content_effectively_available(uuid) is
  'True only for published, enabled, rights-valid content with usable playback. Public catalogue visibility is independent of internal-alpha authentication.';

commit;
