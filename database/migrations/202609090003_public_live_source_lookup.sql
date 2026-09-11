begin;

-- Public live-detail lookup used by the watch route. The function deliberately
-- re-applies the same public availability and live-review predicates rather
-- than relying on a direct RLS read of live_source_configs from application
-- code. It returns no row when any governance boundary is not satisfied.
create or replace function public.get_public_live_source_config(p_playback_source_id uuid)
returns table(
  source_key text,
  delivery_adapter public.live_delivery_adapter,
  official_source_url text,
  terms_url text,
  required_attribution text,
  refresh_interval_seconds integer,
  enabled boolean,
  next_review_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.source_key,
    l.delivery_adapter,
    l.official_source_url,
    l.terms_url,
    l.required_attribution,
    l.refresh_interval_seconds,
    l.enabled,
    l.next_review_at
  from public.live_source_configs l
  join public.playback_sources p on p.id = l.playback_source_id
  where l.playback_source_id = p_playback_source_id
    and l.enabled
    and l.rights_verified_at is not null
    and l.next_review_at > now()
    and public.is_content_effectively_available(p.content_id)
  limit 1
$$;

revoke all on function public.get_public_live_source_config(uuid) from public;
grant execute on function public.get_public_live_source_config(uuid) to anon, authenticated;

comment on function public.get_public_live_source_config(uuid) is
  'Returns a live-source configuration only when the live review and the linked content public-availability boundary are both currently satisfied.';

commit;
