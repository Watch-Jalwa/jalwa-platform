begin;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 1000),
  body_language text not null default 'en' check (body_language in ('en','ur','roman_ur','multi')),
  status text not null default 'visible' check (status in ('visible','pending','hidden','deleted')),
  moderation_reason text,
  score integer not null default 0 check (score >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_content_created_idx on public.comments(content_id,created_at desc) where status='visible';
create index comments_parent_created_idx on public.comments(parent_id,created_at) where status='visible';
create index comments_user_created_idx on public.comments(user_id,created_at desc);
create trigger comments_touch before update on public.comments for each row execute procedure public.touch_updated_at();

create table public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like')),
  created_at timestamptz not null default now(),
  primary key(comment_id,user_id,reaction)
);

create table public.user_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('content','category')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id,entity_type,entity_id)
);

create table public.user_blocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,blocked_user_id),
  check (user_id <> blocked_user_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (reason in ('spam','abuse','hate','harassment','misinformation','rights','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (content_id is not null or comment_id is not null)
);

create unique index content_reports_comment_once_idx on public.content_reports(reporter_id,comment_id) where comment_id is not null and status in ('open','reviewing');
create index content_reports_queue_idx on public.content_reports(status,created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('comment_reply','comment_like','moderation','followed_content')),
  content_id uuid references public.content_items(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;

create table public.recommendation_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  viewer_profile_id uuid references public.viewer_profiles(id) on delete cascade,
  session_id text,
  content_id uuid not null references public.content_items(id) on delete cascade,
  event_type text not null check (event_type in ('impression','open','play_start','progress_25','progress_50','progress_90','complete','like','save','share','hide','report')),
  value numeric,
  source text not null default 'web',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index recommendation_events_profile_idx on public.recommendation_events(viewer_profile_id,created_at desc);
create index recommendation_events_content_idx on public.recommendation_events(content_id,event_type,created_at desc);
create index recommendation_events_recent_idx on public.recommendation_events(created_at desc);

create table public.profile_category_affinities (
  viewer_profile_id uuid not null references public.viewer_profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  score numeric not null default 0,
  event_count integer not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key(viewer_profile_id,category_id)
);

create table public.content_similarity (
  content_id uuid not null references public.content_items(id) on delete cascade,
  similar_content_id uuid not null references public.content_items(id) on delete cascade,
  similarity_kind text not null check (similarity_kind in ('co_watch','semantic','editorial')),
  score numeric not null check (score >= 0),
  refreshed_at timestamptz not null default now(),
  primary key(content_id,similar_content_id,similarity_kind),
  check (content_id <> similar_content_id)
);

create index content_similarity_lookup_idx on public.content_similarity(content_id,score desc);

create table public.recommendation_experiments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  variants jsonb not null check (jsonb_typeof(variants)='array'),
  allocation_percent integer not null default 100 check (allocation_percent between 1 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recommendation_experiments_touch before update on public.recommendation_experiments for each row execute procedure public.touch_updated_at();

create table public.recommendation_assignments (
  experiment_id uuid not null references public.recommendation_experiments(id) on delete cascade,
  viewer_profile_id uuid not null references public.viewer_profiles(id) on delete cascade,
  variant text not null,
  assigned_at timestamptz not null default now(),
  primary key(experiment_id,viewer_profile_id)
);

create or replace function public.create_comment(
  p_content_id uuid,
  p_parent_id uuid,
  p_body text,
  p_language text default 'en'
) returns uuid
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_parent_user uuid;
  v_parent_content uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 2 and 1000 then raise exception 'comment length invalid'; end if;
  if p_language not in ('en','ur','roman_ur','multi') then raise exception 'comment language invalid'; end if;
  if not exists(select 1 from public.content_items where id=p_content_id and status='published') then raise exception 'content unavailable'; end if;

  if p_parent_id is not null then
    select user_id,content_id into v_parent_user,v_parent_content from public.comments where id=p_parent_id and status='visible';
    if v_parent_user is null or v_parent_content <> p_content_id then raise exception 'parent comment unavailable'; end if;
    if exists(select 1 from public.user_blocks where (user_id=v_user and blocked_user_id=v_parent_user) or (user_id=v_parent_user and blocked_user_id=v_user)) then
      raise exception 'reply unavailable';
    end if;
  end if;

  insert into public.comments(content_id,user_id,parent_id,body,body_language,status)
  values(p_content_id,v_user,p_parent_id,trim(p_body),p_language,'visible')
  returning id into v_id;

  if p_parent_id is not null then
    update public.comments set reply_count=reply_count+1 where id=p_parent_id;
    if v_parent_user <> v_user then
      insert into public.notifications(user_id,actor_id,kind,content_id,comment_id)
      values(v_parent_user,v_user,'comment_reply',p_content_id,v_id);
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.toggle_comment_reaction(p_comment_id uuid,p_reaction text default 'like')
returns integer
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_content uuid;
  v_score integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_reaction <> 'like' then raise exception 'unsupported reaction'; end if;
  select user_id,content_id into v_owner,v_content from public.comments where id=p_comment_id and status='visible';
  if v_owner is null then raise exception 'comment unavailable'; end if;

  if exists(select 1 from public.comment_reactions where comment_id=p_comment_id and user_id=v_user and reaction=p_reaction) then
    delete from public.comment_reactions where comment_id=p_comment_id and user_id=v_user and reaction=p_reaction;
  else
    insert into public.comment_reactions(comment_id,user_id,reaction) values(p_comment_id,v_user,p_reaction);
    if v_owner <> v_user then
      insert into public.notifications(user_id,actor_id,kind,content_id,comment_id)
      values(v_owner,v_user,'comment_like',v_content,p_comment_id);
    end if;
  end if;

  select count(*)::integer into v_score from public.comment_reactions where comment_id=p_comment_id;
  update public.comments set score=v_score where id=p_comment_id;
  return v_score;
end;
$$;

create or replace function public.report_comment(p_comment_id uuid,p_reason text,p_details text default null)
returns uuid
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_content uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_reason not in ('spam','abuse','hate','harassment','misinformation','rights','other') then raise exception 'invalid report reason'; end if;
  select content_id into v_content from public.comments where id=p_comment_id;
  if v_content is null then raise exception 'comment unavailable'; end if;
  insert into public.content_reports(reporter_id,content_id,comment_id,reason,details)
  values(v_user,v_content,p_comment_id,p_reason,left(p_details,1000))
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_user_block(p_blocked_user_id uuid,p_block boolean default true)
returns void
language plpgsql
security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if v_user=p_blocked_user_id then raise exception 'cannot block self'; end if;
  if p_block then
    insert into public.user_blocks(user_id,blocked_user_id) values(v_user,p_blocked_user_id) on conflict do nothing;
  else
    delete from public.user_blocks where user_id=v_user and blocked_user_id=p_blocked_user_id;
  end if;
end;
$$;

create or replace function public.set_entity_follow(p_entity_type text,p_entity_id uuid,p_follow boolean default true)
returns void
language plpgsql
security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_entity_type not in ('content','category') then raise exception 'unsupported follow type'; end if;
  if p_follow then
    insert into public.user_follows(user_id,entity_type,entity_id) values(v_user,p_entity_type,p_entity_id) on conflict do nothing;
  else
    delete from public.user_follows where user_id=v_user and entity_type=p_entity_type and entity_id=p_entity_id;
  end if;
end;
$$;

create or replace function public.record_recommendation_event(
  p_viewer_profile_id uuid,
  p_content_id uuid,
  p_event_type text,
  p_session_id text default null,
  p_value numeric default null,
  p_context jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id bigint;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.viewer_profiles where id=p_viewer_profile_id and user_id=v_user) then raise exception 'viewer profile unavailable'; end if;
  if p_event_type not in ('impression','open','play_start','progress_25','progress_50','progress_90','complete','like','save','share','hide','report') then raise exception 'unsupported recommendation event'; end if;
  insert into public.recommendation_events(user_id,viewer_profile_id,session_id,content_id,event_type,value,context)
  values(v_user,p_viewer_profile_id,left(p_session_id,120),p_content_id,p_event_type,p_value,coalesce(p_context,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.refresh_recommendation_models()
returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_affinities integer;
  v_pairs integer;
begin
  delete from public.profile_category_affinities;
  insert into public.profile_category_affinities(viewer_profile_id,category_id,score,event_count,refreshed_at)
  select e.viewer_profile_id,c.primary_category_id,
    sum(case e.event_type when 'complete' then 8 when 'progress_90' then 6 when 'like' then 6 when 'save' then 5 when 'progress_50' then 3 when 'play_start' then 2 when 'open' then 1 when 'hide' then -8 when 'report' then -10 else 0.2 end),
    count(*)::integer,now()
  from public.recommendation_events e
  join public.content_items c on c.id=e.content_id
  where e.viewer_profile_id is not null and c.primary_category_id is not null and e.created_at>now()-interval '120 days'
  group by e.viewer_profile_id,c.primary_category_id;
  get diagnostics v_affinities=row_count;

  delete from public.content_similarity where similarity_kind='co_watch';
  with watched as (
    select distinct viewer_profile_id,content_id
    from public.recommendation_events
    where viewer_profile_id is not null and event_type in ('play_start','progress_50','progress_90','complete','like','save') and created_at>now()-interval '120 days'
  ), pairs as (
    select a.content_id,b.content_id as similar_content_id,count(*)::numeric as together
    from watched a join watched b on a.viewer_profile_id=b.viewer_profile_id and a.content_id<>b.content_id
    group by a.content_id,b.content_id
  ), totals as (
    select content_id,count(distinct viewer_profile_id)::numeric as viewers from watched group by content_id
  )
  insert into public.content_similarity(content_id,similar_content_id,similarity_kind,score,refreshed_at)
  select p.content_id,p.similar_content_id,'co_watch',p.together/nullif(sqrt(t1.viewers*t2.viewers),0),now()
  from pairs p join totals t1 on t1.content_id=p.content_id join totals t2 on t2.content_id=p.similar_content_id
  where p.together>=2;
  get diagnostics v_pairs=row_count;

  return jsonb_build_object('affinities',v_affinities,'coWatchPairs',v_pairs,'refreshedAt',now());
end;
$$;

create or replace function public.get_recommendations(
  p_viewer_profile_id uuid,
  p_limit integer default 24,
  p_context_content_id uuid default null
) returns table(
  id uuid,
  slug text,
  title text,
  title_ur text,
  description text,
  category_name text,
  category_slug text,
  duration_seconds integer,
  access_level public.access_level,
  content_type public.content_type,
  hosting_mode public.hosting_mode,
  thumbnail_url text,
  recommendation_score numeric,
  recommendation_reason text
)
language sql
security definer set search_path=''
stable
as $$
  with profile as (
    select vp.id,vp.user_id,vp.kids_mode from public.viewer_profiles vp
    where vp.id=p_viewer_profile_id and vp.user_id=(select auth.uid())
  ), recent_seed as (
    select wp.content_id
    from public.watch_progress wp join profile p on p.id=wp.viewer_profile_id
    order by wp.last_watched_at desc limit 12
  ), trending as (
    select e.content_id,
      sum(case e.event_type when 'complete' then 5 when 'progress_90' then 4 when 'like' then 4 when 'save' then 3 when 'play_start' then 1 else 0.2 end) as score
    from public.recommendation_events e
    where e.created_at>now()-interval '14 days'
    group by e.content_id
  ), similar_items as (
    select cs.similar_content_id,max(cs.score) as score
    from public.content_similarity cs
    where cs.content_id=p_context_content_id or cs.content_id in (select content_id from recent_seed)
    group by cs.similar_content_id
  ), candidates as (
    select c.*,cat.name_en as category_name,cat.slug as category_slug,
      coalesce(a.score,0)*1.8 + coalesce(t.score,0)*0.15 + coalesce(s.score,0)*8
      + greatest(0,30-extract(day from now()-coalesce(c.published_at,c.created_at)))*0.04
      - case when exists(select 1 from public.watch_progress wp join profile p on p.id=wp.viewer_profile_id where wp.content_id=c.id and wp.completed) then 4 else 0 end
      - case when exists(select 1 from public.recommendation_events e join profile p on p.id=e.viewer_profile_id where e.content_id=c.id and e.event_type in ('hide','report') and e.created_at>now()-interval '180 days') then 100 else 0 end
      as score,
      case
        when s.score is not null then 'Because you watched related content'
        when a.score is not null and a.score>3 then 'Matches your interests'
        when t.score is not null and t.score>4 then 'Trending now'
        else 'Fresh on Jalwa'
      end as reason
    from public.content_items c
    join public.categories cat on cat.id=c.primary_category_id
    cross join profile p
    left join public.profile_category_affinities a on a.viewer_profile_id=p.id and a.category_id=c.primary_category_id
    left join trending t on t.content_id=c.id
    left join similar_items s on s.similar_content_id=c.id
    where c.status='published'
      and (not p.kids_mode or c.audience in ('kids','family','general'))
      and (p_context_content_id is null or c.id<>p_context_content_id)
  )
  select c.id,c.slug,c.title_en,c.title_ur,c.description_en,c.category_name,c.category_slug,c.duration_seconds,c.access_level,c.content_type,c.hosting_mode,c.thumbnail_url,c.score,c.reason
  from candidates c
  order by c.score desc,c.published_at desc nulls last,c.created_at desc
  limit greatest(1,least(coalesce(p_limit,24),60));
$$;

grant execute on function public.create_comment(uuid,uuid,text,text) to authenticated;
grant execute on function public.toggle_comment_reaction(uuid,text) to authenticated;
grant execute on function public.report_comment(uuid,text,text) to authenticated;
grant execute on function public.set_user_block(uuid,boolean) to authenticated;
grant execute on function public.set_entity_follow(text,uuid,boolean) to authenticated;
grant execute on function public.record_recommendation_event(uuid,uuid,text,text,numeric,jsonb) to authenticated;
grant execute on function public.get_recommendations(uuid,integer,uuid) to authenticated;

alter table public.comments enable row level security;
alter table public.comment_reactions enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.profile_category_affinities enable row level security;
alter table public.content_similarity enable row level security;
alter table public.recommendation_experiments enable row level security;
alter table public.recommendation_assignments enable row level security;

create policy "visible comments public read" on public.comments for select using(
  status='visible' and not exists(
    select 1 from public.user_blocks b where (b.user_id=(select auth.uid()) and b.blocked_user_id=comments.user_id)
  )
);
create policy "comments own update" on public.comments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "comments staff manage" on public.comments for all to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));

create policy "reactions public read" on public.comment_reactions for select using(true);
create policy "reactions own manage" on public.comment_reactions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "follows own manage" on public.user_follows for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "blocks own manage" on public.user_blocks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "reports own read" on public.content_reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy "reports staff manage" on public.content_reports for all to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));
create policy "notifications own read" on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy "notifications own update" on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "recommendation events own read" on public.recommendation_events for select to authenticated using(user_id=(select auth.uid()));
create policy "affinities own read" on public.profile_category_affinities for select to authenticated using(exists(select 1 from public.viewer_profiles where id=viewer_profile_id and user_id=(select auth.uid())));
create policy "similarity public read" on public.content_similarity for select using(true);
create policy "experiments public read" on public.recommendation_experiments for select using(status='active');
create policy "assignments own read" on public.recommendation_assignments for select to authenticated using(exists(select 1 from public.viewer_profiles where id=viewer_profile_id and user_id=(select auth.uid())));

commit;
