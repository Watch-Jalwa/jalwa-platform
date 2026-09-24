begin;

-- Make each advertised Premium entitlement enforce a real product boundary.
-- Early Access is rights-aware and only bypasses the public publish_at window;
-- it never bypasses rights, availability, takedown, source or unpublish gates.

create or replace function public.can_access_release_window(
  p_publish_at timestamptz,
  p_unpublish_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_unpublish_at is null or p_unpublish_at > now())
    and (
      p_publish_at is null
      or p_publish_at <= now()
      or public.has_active_benefit('early_access')
      or public.is_staff()
    )
$$;

grant execute on function public.can_access_release_window(timestamptz,timestamptz) to anon, authenticated;

create or replace function public.search_catalogue(
  p_query text default null,
  p_category text default null,
  p_limit integer default 40
)
returns table(
  id uuid,
  slug text,
  title text,
  title_ur text,
  description text,
  category_slug text,
  category_name text,
  content_type public.content_type,
  hosting_mode public.hosting_mode,
  access_level public.access_level,
  duration_seconds integer,
  thumbnail_url text,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.slug, c.title_en, c.title_ur, c.description_en, cat.slug, cat.name_en,
    c.content_type, c.hosting_mode, c.access_level, c.duration_seconds, c.thumbnail_url, c.publish_at
  from public.content_items c
  left join public.categories cat on cat.id = c.primary_category_id
  where c.status = 'published'
    and c.is_available
    and c.disabled_at is null
    and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
    and public.can_access_release_window(c.publish_at, c.unpublish_at)
    and (p_category is null or p_category = '' or cat.slug = p_category)
    and (
      p_query is null or p_query = ''
      or to_tsvector('simple', coalesce(c.title_en, '') || ' ' || coalesce(c.title_ur, '') || ' ' || coalesce(c.title_roman_ur, '') || ' ' || coalesce(c.description_en, ''))
        @@ websearch_to_tsquery('simple', p_query)
      or extensions.similarity(c.title_en, p_query) > .2
    )
  order by c.is_featured desc, c.publish_at desc nulls last, c.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

drop policy if exists "catalogue public" on public.content_items;
create policy "catalogue public" on public.content_items
for select using (
  public.is_staff()
  or (
    status = 'published'
    and is_available
    and disabled_at is null
    and public.has_publishable_rights(id, hosting_mode, access_level)
    and public.can_access_release_window(publish_at, unpublish_at)
  )
);

drop policy if exists "playback public" on public.playback_sources;
create policy "playback public" on public.playback_sources
for select using (
  public.is_staff()
  or exists (
    select 1
    from public.content_items c
    where c.id = content_id
      and c.status = 'published'
      and c.is_available
      and c.disabled_at is null
      and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
      and public.can_access_release_window(c.publish_at, c.unpublish_at)
  )
);

drop policy if exists "collections public" on public.collections;
create policy "collections public" on public.collections
for select using (
  public.is_staff()
  or (
    status = 'published'
    and public.can_access_release_window(publish_at, null)
  )
);

drop policy if exists "collection items public" on public.collection_items;
create policy "collection items public" on public.collection_items
for select using (
  public.is_staff()
  or exists (
    select 1
    from public.collections c
    where c.id = collection_id
      and c.status = 'published'
      and public.can_access_release_window(c.publish_at, null)
      and (
        c.access_level <> 'premium'
        or public.has_active_benefit('premium_collections')
      )
  )
);

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
      and public.can_access_release_window(c.publish_at, c.unpublish_at)
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
        c.content_type <> 'live'
        or exists(
          select 1
          from public.playback_sources lp
          join public.live_source_configs l on l.playback_source_id = lp.id
          join public.approved_live_catalogue_manifest m
            on m.source_key = l.source_key
           and m.slug = c.slug
          where lp.content_id = c.id
            and lp.is_primary
            and lp.status = 'active'
            and lp.is_available
            and lp.disabled_at is null
            and l.enabled
            and l.rights_verified_at is not null
            and l.next_review_at > now()
        )
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
              or (
                c.content_type = 'live'
                and exists(
                  select 1
                  from public.live_source_configs l
                  join public.approved_live_catalogue_manifest m
                    on m.source_key = l.source_key
                   and m.slug = c.slug
                  where l.playback_source_id = p.id
                    and l.enabled
                    and l.rights_verified_at is not null
                    and l.next_review_at > now()
                    and l.delivery_adapter = 'public_domain_live_image'
                    and l.expected_media_type = 'current_image'
                )
              )
            )
        )
      )
  )
$$;

comment on function public.can_access_release_window(timestamptz,timestamptz) is
  'Public release-window gate. Future publish_at content is visible only to staff or viewers with active early_access entitlement; unpublish_at always fails closed.';

comment on function public.is_content_effectively_available(uuid) is
  'True only for rights-valid, enabled and usable content inside the viewer release window. Active early_access may open a future publish_at window but does not bypass any other safety/rights gate.';

commit;
