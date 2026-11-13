-- Backfill catalogue posters for published videos/shorts.
-- Prefer official YouTube art when embedded; otherwise point at the public poster route
-- that serves the FFmpeg frame already written under processed/{content}/{asset}/thumbnail.jpg.

update public.content_items as c
set thumbnail_url = format('https://i.ytimg.com/vi/%s/hqdefault.jpg', ps.provider_content_id),
    updated_at = now()
from public.playback_sources as ps
where ps.content_id = c.id
  and ps.is_primary = true
  and ps.status = 'active'
  and ps.provider = 'youtube'
  and coalesce(nullif(btrim(ps.provider_content_id), ''), '') <> ''
  and c.status = 'published'
  and c.content_type in ('video', 'short')
  and (c.thumbnail_url is null or btrim(c.thumbnail_url) = '');

update public.content_items as c
set thumbnail_url = '/api/catalogue/poster/' || c.id::text,
    updated_at = now()
where c.status = 'published'
  and c.content_type in ('video', 'short')
  and (c.thumbnail_url is null or btrim(c.thumbnail_url) = '')
  and exists (
    select 1
    from public.playback_sources ps
    where ps.content_id = c.id
      and ps.is_primary = true
      and ps.status = 'active'
      and ps.media_asset_id is not null
  );
