begin;

alter table public.rights_records
  add column if not exists evidence_url text,
  add column if not exists evidence_note text,
  add column if not exists expires_at timestamptz,
  add column if not exists takedown_contact text,
  add column if not exists review_notes text;

create index if not exists rights_records_expiry_idx
  on public.rights_records(status, expires_at)
  where status = 'approved';

create or replace function public.enforce_rights_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hosting_mode public.hosting_mode;
  v_access_level public.access_level;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select hosting_mode, access_level
    into v_hosting_mode, v_access_level
  from public.content_items
  where id = new.content_id;

  if v_hosting_mode is null then
    raise exception 'content item is required before rights approval';
  end if;
  if nullif(btrim(new.source_url), '') is null then
    raise exception 'source URL is required before rights approval';
  end if;
  if nullif(btrim(coalesce(new.creator, '')), '') is null then
    raise exception 'source organisation or creator is required before rights approval';
  end if;
  if nullif(btrim(coalesce(new.licence_code, '')), '') is null then
    raise exception 'licence or permission basis is required before rights approval';
  end if;
  if nullif(btrim(coalesce(new.attribution_text, '')), '') is null then
    raise exception 'attribution text is required before rights approval';
  end if;
  if nullif(btrim(coalesce(new.evidence_url, '')), '') is null
     and nullif(btrim(coalesce(new.evidence_note, '')), '') is null then
    raise exception 'rights evidence is required before approval';
  end if;
  if nullif(btrim(coalesce(new.takedown_contact, '')), '') is null then
    raise exception 'takedown contact is required before rights approval';
  end if;
  if new.expires_at is not null and new.expires_at <= now() then
    raise exception 'expired rights cannot be approved';
  end if;
  if v_hosting_mode = 'embed_only' and not new.embedding_confirmed then
    raise exception 'embedding permission is required for embed-only content';
  end if;
  if v_hosting_mode in ('self_host_open', 'self_host_owned') and not new.self_hosting_confirmed then
    raise exception 'self-hosting permission is required for self-hosted content';
  end if;
  if (v_hosting_mode in ('self_host_open', 'self_host_owned') or v_access_level = 'premium')
     and not new.commercial_use_confirmed then
    raise exception 'commercial-use permission is required for self-hosted or premium content';
  end if;

  new.verified_at = coalesce(new.verified_at, now());
  return new;
end
$$;

drop trigger if exists enforce_rights_approval on public.rights_records;
create trigger enforce_rights_approval
before insert or update on public.rights_records
for each row execute procedure public.enforce_rights_approval();

create or replace function public.has_publishable_rights(
  p_content_id uuid,
  p_hosting_mode public.hosting_mode,
  p_access_level public.access_level
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rights_records r
    where r.content_id = p_content_id
      and r.status = 'approved'
      and nullif(btrim(r.source_url), '') is not null
      and nullif(btrim(coalesce(r.creator, '')), '') is not null
      and nullif(btrim(coalesce(r.licence_code, '')), '') is not null
      and nullif(btrim(coalesce(r.attribution_text, '')), '') is not null
      and (
        nullif(btrim(coalesce(r.evidence_url, '')), '') is not null
        or nullif(btrim(coalesce(r.evidence_note, '')), '') is not null
      )
      and nullif(btrim(coalesce(r.takedown_contact, '')), '') is not null
      and (r.expires_at is null or r.expires_at > now())
      and (p_hosting_mode <> 'embed_only' or r.embedding_confirmed)
      and (p_hosting_mode not in ('self_host_open', 'self_host_owned') or r.self_hosting_confirmed)
      and (
        (p_hosting_mode not in ('self_host_open', 'self_host_owned') and p_access_level <> 'premium')
        or r.commercial_use_confirmed
      )
  )
$$;

create or replace function public.enforce_content_publish_rights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    if not public.has_publishable_rights(new.id, new.hosting_mode, new.access_level) then
      raise exception 'complete, current and mode-compatible rights approval is required before publishing';
    end if;
    new.publish_at = coalesce(new.publish_at, now());
  end if;
  return new;
end
$$;

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
    and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
    and (c.publish_at is null or c.publish_at <= now())
    and (c.unpublish_at is null or c.unpublish_at > now())
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
    and public.has_publishable_rights(id, hosting_mode, access_level)
    and (publish_at is null or publish_at <= now())
    and (unpublish_at is null or unpublish_at > now())
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
      and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
      and (c.publish_at is null or c.publish_at <= now())
      and (c.unpublish_at is null or c.unpublish_at > now())
  )
);

grant execute on function public.has_publishable_rights(uuid, public.hosting_mode, public.access_level)
  to anon, authenticated;

commit;
