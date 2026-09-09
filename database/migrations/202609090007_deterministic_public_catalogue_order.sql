begin;

-- Keep public catalogue ordering deterministic when multiple governed items
-- share the same featured/publication/creation timestamps. This preserves the
-- existing ranking semantics and only resolves otherwise-undefined ties.
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
  select
    c.id,
    c.slug,
    c.title_en,
    c.title_ur,
    c.description_en,
    cat.slug,
    cat.name_en,
    c.content_type,
    c.hosting_mode,
    c.access_level,
    c.duration_seconds,
    c.thumbnail_url,
    c.publish_at
  from public.content_items c
  left join public.categories cat on cat.id = c.primary_category_id
  where public.is_content_effectively_available(c.id)
    and (p_category is null or p_category = '' or cat.slug = p_category)
    and (
      p_query is null
      or p_query = ''
      or to_tsvector(
        'simple',
        coalesce(c.title_en, '') || ' ' ||
        coalesce(c.title_ur, '') || ' ' ||
        coalesce(c.title_roman_ur, '') || ' ' ||
        coalesce(c.description_en, '')
      ) @@ websearch_to_tsquery('simple', p_query)
      or extensions.similarity(c.title_en, p_query) > .2
    )
  order by
    c.is_featured desc,
    c.publish_at desc nulls last,
    c.created_at desc,
    c.slug asc
  limit least(greatest(p_limit, 1), 100)
$$;

comment on function public.search_catalogue(text, text, integer) is
  'Returns the governed public catalogue using stable ranking with slug as the unique final tie-breaker.';

commit;
