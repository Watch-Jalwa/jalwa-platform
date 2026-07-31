begin;

create or replace function public.build_account_export(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'identity', coalesce((
      select jsonb_build_object(
        'id',u.id,'email',u.email,'phone',u.phone,'createdAt',u.created_at,
        'updatedAt',u.updated_at,'lastSignInAt',u.last_sign_in_at,
        'userMetadata',u.raw_user_meta_data
      ) from auth.users u where u.id=p_user_id
    ), '{}'::jsonb),
    'profile', coalesce((select to_jsonb(p) from public.profiles p where p.id=p_user_id), '{}'::jsonb),
    'viewerProfiles', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at) from public.viewer_profiles v where v.user_id=p_user_id), '[]'::jsonb),
    'watchProgress', coalesce((select jsonb_agg(to_jsonb(w) order by w.last_watched_at desc) from public.watch_progress w where w.user_id=p_user_id), '[]'::jsonb),
    'offlineItems', coalesce((select jsonb_agg(to_jsonb(o) order by o.downloaded_at desc) from public.offline_items o where o.user_id=p_user_id), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(to_jsonb(d) - 'device_key' order by d.created_at desc) from public.user_devices d where d.user_id=p_user_id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.comments c where c.user_id=p_user_id), '[]'::jsonb),
    'commentReactions', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.comment_reactions r where r.user_id=p_user_id), '[]'::jsonb),
    'follows', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from public.user_follows f where f.user_id=p_user_id), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.user_blocks b where b.user_id=p_user_id), '[]'::jsonb),
    'mutes', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc) from public.user_mutes m where m.user_id=p_user_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.content_reports r where r.reporter_id=p_user_id), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.notifications n where n.user_id=p_user_id), '[]'::jsonb),
    'recommendationEvents', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.recommendation_events r where r.user_id=p_user_id), '[]'::jsonb),
    'supportCases', coalesce((select jsonb_agg(to_jsonb(s) - 'internal_note' order by s.created_at desc) from public.support_cases s where s.user_id=p_user_id), '[]'::jsonb),
    'accountRequests', coalesce((select jsonb_agg(to_jsonb(a) - array['internal_note','error_message','locked_by','subject_hash'] order by a.requested_at desc) from public.account_requests a where a.user_id=p_user_id), '[]'::jsonb),
    'checkoutOrders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from public.checkout_orders o where o.user_id=p_user_id), '[]'::jsonb),
    'paymentAttempts', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.payment_attempts p where exists(select 1 from public.checkout_orders o where o.id=p.checkout_order_id and o.user_id=p_user_id)), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.subscriptions s where s.user_id=p_user_id), '[]'::jsonb),
    'entitlements', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.entitlements e where e.user_id=p_user_id), '[]'::jsonb),
    'aiConversations', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.ai_conversations c where c.user_id=p_user_id), '[]'::jsonb),
    'aiMessages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.ai_messages m where exists(select 1 from public.ai_conversations c where c.id=m.conversation_id and c.user_id=p_user_id)), '[]'::jsonb),
    'analyticsEvents', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.analytics_events a where a.user_id=p_user_id), '[]'::jsonb),
    'liveSessions', coalesce((select jsonb_agg(to_jsonb(l) order by l.started_at desc) from public.live_viewer_sessions l where l.user_id=p_user_id), '[]'::jsonb),
    'drmLicenceEvents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.drm_license_events d where d.user_id=p_user_id), '[]'::jsonb),
    'auditEvents', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.audit_logs a where a.actor_id=p_user_id), '[]'::jsonb)
  );
$$;

create or replace function public.deidentify_retained_account_records(p_user_id uuid, p_subject_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_subject_hash is null or char_length(p_subject_hash) < 32 then raise exception 'subject hash required'; end if;
  update public.support_cases set email=null,metadata=metadata || jsonb_build_object('deletedSubject',p_subject_hash) where user_id=p_user_id;
  update public.checkout_orders set idempotency_key='deleted:'||id::text where user_id=p_user_id;
  update public.audit_logs set metadata=metadata || jsonb_build_object('deletedSubject',p_subject_hash) where actor_id=p_user_id;
  update public.account_requests set subject_hash=p_subject_hash where user_id=p_user_id;
end;
$$;

revoke all on function public.build_account_export(uuid) from public,anon,authenticated;
grant execute on function public.build_account_export(uuid) to service_role;
revoke all on function public.deidentify_retained_account_records(uuid,text) from public,anon,authenticated;
grant execute on function public.deidentify_retained_account_records(uuid,text) to service_role;

commit;
