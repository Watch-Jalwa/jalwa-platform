begin;

create or replace function public.mark_notifications_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  update public.notifications
  set read_at=coalesce(read_at,now())
  where user_id=v_user
    and read_at is null
    and (p_notification_id is null or id=p_notification_id);
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_notifications_read(uuid) to authenticated;
revoke execute on function public.touch_live_session(uuid,text,uuid,integer,text) from anon,authenticated;
grant execute on function public.touch_live_session(uuid,text,uuid,integer,text) to service_role;

revoke insert,update,delete on public.comments from anon,authenticated;
revoke insert,update,delete on public.comment_reactions from anon,authenticated;
revoke insert,update,delete on public.user_follows from anon,authenticated;
revoke insert,update,delete on public.user_blocks from anon,authenticated;
revoke insert,update,delete on public.user_mutes from anon,authenticated;
revoke insert,update,delete on public.content_reports from anon,authenticated;
revoke insert,update,delete on public.notifications from anon,authenticated;
revoke insert,update,delete on public.recommendation_events from anon,authenticated;
revoke insert,update,delete on public.profile_category_affinities from anon,authenticated;
revoke insert,update,delete on public.content_similarity from anon,authenticated;
revoke insert,update,delete on public.content_embeddings from anon,authenticated;
revoke insert,update,delete on public.recommendation_assignments from anon,authenticated;

commit;
