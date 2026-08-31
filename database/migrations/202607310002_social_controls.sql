begin;

create table public.content_comment_settings (
  content_id uuid primary key references public.content_items(id) on delete cascade,
  comments_enabled boolean not null default true,
  replies_enabled boolean not null default true,
  approval_required boolean not null default false,
  slow_mode_seconds integer not null default 15 check (slow_mode_seconds between 0 and 3600),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger content_comment_settings_touch before update on public.content_comment_settings for each row execute procedure public.touch_updated_at();

insert into public.content_comment_settings(content_id)
select id from public.content_items
on conflict do nothing;

create or replace function public.create_content_comment_settings()
returns trigger
language plpgsql
security definer set search_path=''
as $$
begin
  insert into public.content_comment_settings(content_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger content_comment_settings_after_content
  after insert on public.content_items
  for each row execute procedure public.create_content_comment_settings();

create table public.user_mutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('user','content','category')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id,entity_type,entity_id)
);

revoke execute on function public.create_comment(uuid,uuid,text,text) from authenticated;
drop function public.create_comment(uuid,uuid,text,text);

create or replace function public.create_comment(
  p_viewer_profile_id uuid,
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
  v_settings public.content_comment_settings%rowtype;
  v_last_created timestamptz;
  v_status text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.viewer_profiles where id=p_viewer_profile_id and user_id=v_user and kids_mode=false) then
    raise exception 'comments unavailable for this viewer profile';
  end if;
  if char_length(trim(coalesce(p_body,''))) not between 2 and 1000 then raise exception 'comment length invalid'; end if;
  if p_language not in ('en','ur','roman_ur','multi') then raise exception 'comment language invalid'; end if;
  if not exists(select 1 from public.content_items where id=p_content_id and status='published') then raise exception 'content unavailable'; end if;

  select * into v_settings from public.content_comment_settings where content_id=p_content_id;
  if not found then
    insert into public.content_comment_settings(content_id) values(p_content_id) returning * into v_settings;
  end if;
  if not v_settings.comments_enabled then raise exception 'comments disabled'; end if;

  select max(created_at) into v_last_created from public.comments where user_id=v_user and content_id=p_content_id;
  if v_last_created is not null and v_last_created + make_interval(secs=>v_settings.slow_mode_seconds)>now() then
    raise exception 'slow mode active';
  end if;

  if p_parent_id is not null then
    if not v_settings.replies_enabled then raise exception 'replies disabled'; end if;
    select user_id,content_id into v_parent_user,v_parent_content from public.comments where id=p_parent_id and status='visible';
    if v_parent_user is null or v_parent_content<>p_content_id then raise exception 'parent comment unavailable'; end if;
    if exists(select 1 from public.user_blocks where (user_id=v_user and blocked_user_id=v_parent_user) or (user_id=v_parent_user and blocked_user_id=v_user)) then
      raise exception 'reply unavailable';
    end if;
  end if;

  v_status := case when v_settings.approval_required then 'pending' else 'visible' end;
  insert into public.comments(content_id,user_id,parent_id,body,body_language,status)
  values(p_content_id,v_user,p_parent_id,trim(p_body),p_language,v_status)
  returning id into v_id;

  if p_parent_id is not null and v_status='visible' then
    update public.comments set reply_count=reply_count+1 where id=p_parent_id;
    if v_parent_user<>v_user then
      insert into public.notifications(user_id,actor_id,kind,content_id,comment_id)
      values(v_parent_user,v_user,'comment_reply',p_content_id,v_id);
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.edit_comment(p_comment_id uuid,p_body text,p_language text default 'en')
returns void
language plpgsql
security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 2 and 1000 then raise exception 'comment length invalid'; end if;
  if p_language not in ('en','ur','roman_ur','multi') then raise exception 'comment language invalid'; end if;
  update public.comments set body=trim(p_body),body_language=p_language,edited_at=now()
  where id=p_comment_id and user_id=v_user and status in ('visible','pending');
  if not found then raise exception 'comment unavailable'; end if;
end;
$$;

create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_parent uuid;
  v_visible boolean;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select parent_id,status='visible' into v_parent,v_visible from public.comments where id=p_comment_id and user_id=v_user;
  if not found then raise exception 'comment unavailable'; end if;
  update public.comments set body='Comment removed',status='deleted',moderation_reason=null where id=p_comment_id;
  delete from public.comment_reactions where comment_id=p_comment_id;
  if v_parent is not null and v_visible then update public.comments set reply_count=greatest(reply_count-1,0) where id=v_parent; end if;
end;
$$;

create or replace function public.set_user_mute(p_entity_type text,p_entity_id uuid,p_mute boolean default true)
returns void
language plpgsql
security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_entity_type not in ('user','content','category') then raise exception 'unsupported mute type'; end if;
  if p_entity_type='user' and p_entity_id=v_user then raise exception 'cannot mute self'; end if;
  if p_mute then
    insert into public.user_mutes(user_id,entity_type,entity_id) values(v_user,p_entity_type,p_entity_id) on conflict do nothing;
  else
    delete from public.user_mutes where user_id=v_user and entity_type=p_entity_type and entity_id=p_entity_id;
  end if;
end;
$$;

create or replace function public.moderate_comment(p_comment_id uuid,p_action text,p_reason text default null)
returns void
language plpgsql
security definer set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before text;
  v_parent uuid;
begin
  if not exists(select 1 from public.profiles where id=v_actor and role in ('editor','admin')) then raise exception 'staff role required'; end if;
  if p_action not in ('approve','hide','delete','restore') then raise exception 'unsupported moderation action'; end if;
  select status,parent_id into v_before,v_parent from public.comments where id=p_comment_id;
  if not found then raise exception 'comment unavailable'; end if;

  update public.comments
  set status=case p_action when 'approve' then 'visible' when 'restore' then 'visible' when 'hide' then 'hidden' else 'deleted' end,
      body=case when p_action='delete' then 'Comment removed by moderation' else body end,
      moderation_reason=case when p_action in ('hide','delete') then left(coalesce(p_reason,'policy'),500) else null end
  where id=p_comment_id;

  if v_parent is not null and v_before<>'visible' and p_action in ('approve','restore') then
    update public.comments set reply_count=reply_count+1 where id=v_parent;
  elsif v_parent is not null and v_before='visible' and p_action in ('hide','delete') then
    update public.comments set reply_count=greatest(reply_count-1,0) where id=v_parent;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'comment_'||p_action,'comment',p_comment_id::text,jsonb_build_object('reason',p_reason,'previousStatus',v_before));
end;
$$;

create or replace function public.resolve_content_report(p_report_id uuid,p_status text,p_note text default null)
returns void
language plpgsql
security definer set search_path=''
as $$
declare v_actor uuid := (select auth.uid());
begin
  if not exists(select 1 from public.profiles where id=v_actor and role in ('editor','admin')) then raise exception 'staff role required'; end if;
  if p_status not in ('reviewing','resolved','dismissed') then raise exception 'unsupported report status'; end if;
  update public.content_reports set status=p_status,assigned_to=v_actor,resolution_note=left(p_note,1000),resolved_at=case when p_status in ('resolved','dismissed') then now() else null end
  where id=p_report_id;
  if not found then raise exception 'report unavailable'; end if;
end;
$$;

grant execute on function public.create_comment(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.edit_comment(uuid,text,text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
grant execute on function public.set_user_mute(text,uuid,boolean) to authenticated;
grant execute on function public.moderate_comment(uuid,text,text) to authenticated;
grant execute on function public.resolve_content_report(uuid,text,text) to authenticated;

alter table public.content_comment_settings enable row level security;
alter table public.user_mutes enable row level security;

create policy "comment settings public read" on public.content_comment_settings for select using(true);
create policy "comment settings staff manage" on public.content_comment_settings for all to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));
create policy "mutes own manage" on public.user_mutes for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists "visible comments public read" on public.comments;
create policy "visible comments public read" on public.comments for select using(
  status in ('visible','deleted')
  and not exists(select 1 from public.user_blocks b where
    (b.user_id=(select auth.uid()) and b.blocked_user_id=comments.user_id)
    or (b.user_id=comments.user_id and b.blocked_user_id=(select auth.uid()))
  )
  and not exists(select 1 from public.user_mutes m where m.user_id=(select auth.uid()) and m.entity_type='user' and m.entity_id=comments.user_id)
);

commit;
