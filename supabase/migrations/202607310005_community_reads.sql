begin;

create or replace function public.get_content_comments(p_content_id uuid)
returns table(
  id uuid,
  user_id uuid,
  parent_id uuid,
  author text,
  body text,
  body_language text,
  score integer,
  reply_count integer,
  edited_at timestamptz,
  created_at timestamptz,
  mine boolean,
  liked_by_me boolean
)
language sql
security definer set search_path=''
stable
as $$
  select c.id,c.user_id,c.parent_id,coalesce(nullif(trim(p.display_name),''),'Jalwa viewer'),c.body,c.body_language,c.score,c.reply_count,c.edited_at,c.created_at,
    c.user_id=(select auth.uid()) as mine,
    exists(select 1 from public.comment_reactions r where r.comment_id=c.id and r.user_id=(select auth.uid()) and r.reaction='like') as liked_by_me
  from public.comments c
  join public.profiles p on p.id=c.user_id
  where c.content_id=p_content_id
    and c.status in ('visible','deleted')
    and not exists(select 1 from public.user_blocks b where
      (b.user_id=(select auth.uid()) and b.blocked_user_id=c.user_id)
      or (b.user_id=c.user_id and b.blocked_user_id=(select auth.uid())))
    and not exists(select 1 from public.user_mutes m where m.user_id=(select auth.uid()) and m.entity_type='user' and m.entity_id=c.user_id)
  order by c.created_at;
$$;

create or replace function public.get_my_notifications(p_limit integer default 100)
returns table(
  id uuid,
  kind text,
  actor text,
  content_id uuid,
  comment_id uuid,
  content_slug text,
  content_title text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer set search_path=''
stable
as $$
  select n.id,n.kind,coalesce(nullif(trim(p.display_name),''),'Jalwa'),n.content_id,n.comment_id,c.slug,c.title_en,n.payload,n.read_at,n.created_at
  from public.notifications n
  left join public.profiles p on p.id=n.actor_id
  left join public.content_items c on c.id=n.content_id
  where n.user_id=(select auth.uid())
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

grant execute on function public.get_content_comments(uuid) to anon,authenticated;
grant execute on function public.get_my_notifications(integer) to authenticated;

commit;
