begin;

-- PostgreSQL functions are executable by PUBLIC unless explicitly revoked. Keep
-- worker/model control functions outside PostgREST's anonymous/authenticated surface.
revoke all on function public.claim_media_job(text) from public, anon, authenticated;
grant execute on function public.claim_media_job(text) to service_role;

revoke all on function public.claim_drm_packaging_job(text) from public, anon, authenticated;
grant execute on function public.claim_drm_packaging_job(text) to service_role;

revoke all on function public.refresh_recommendation_models() from public, anon, authenticated;
grant execute on function public.refresh_recommendation_models() to service_role;

revoke all on function public.refresh_semantic_similarity(integer) from public, anon, authenticated;
grant execute on function public.refresh_semantic_similarity(integer) to service_role;

-- Prevent future SECURITY DEFINER functions created by the migration owner from
-- silently inheriting PUBLIC execution.
alter default privileges in schema public revoke execute on functions from public;

-- Checkout rows must only be created through create_checkout_order(), which copies
-- the authoritative amount and currency from the active price.
drop policy if exists "orders own insert" on public.checkout_orders;
revoke insert, update, delete on public.checkout_orders from anon, authenticated;
revoke insert, update, delete on public.payment_attempts from anon, authenticated;
revoke insert, update, delete on public.webhook_events from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.entitlements from anon, authenticated;

revoke all on function public.create_checkout_order(uuid, public.payment_provider, text) from public, anon;
grant execute on function public.create_checkout_order(uuid, public.payment_provider, text) to authenticated;
revoke all on function public.activate_paid_order(uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.activate_paid_order(uuid, text, text, integer, text, text) to service_role;

-- A revoked device cannot be re-enabled by directly clearing revoked_at.
drop policy if exists "devices own update" on public.user_devices;
revoke insert, update, delete on public.user_devices from anon, authenticated;

create or replace function public.revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  update public.user_devices
  set revoked_at = coalesce(revoked_at, now())
  where id = p_device_id and user_id = v_user;
  if not found then raise exception 'device unavailable'; end if;
end;
$$;

revoke all on function public.revoke_device(uuid) from public, anon;
grant execute on function public.revoke_device(uuid) to authenticated;
revoke all on function public.register_device(text, text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text, text) to authenticated;

-- Users may read/delete their AI history, but only the controlled API can persist a
-- fixed user/assistant pair. This prevents forged system/assistant messages.
drop policy if exists "users create own ai conversations" on public.ai_conversations;
drop policy if exists "users create own ai messages" on public.ai_messages;
revoke insert, update on public.ai_conversations from anon, authenticated;
revoke insert, update, delete on public.ai_messages from anon, authenticated;

create or replace function public.store_ai_exchange(
  p_language text,
  p_context_content_id uuid,
  p_question text,
  p_answer text,
  p_cited_content_ids uuid[],
  p_model_key text,
  p_prompt_version text,
  p_input_tokens integer,
  p_output_tokens integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_conversation uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_language not in ('en', 'ur', 'roman_ur') then raise exception 'invalid language'; end if;
  if char_length(trim(coalesce(p_question, ''))) not between 3 and 1200 then raise exception 'invalid question'; end if;
  if char_length(trim(coalesce(p_answer, ''))) not between 1 and 20000 then raise exception 'invalid answer'; end if;
  if p_context_content_id is not null and not exists (
    select 1 from public.content_items where id = p_context_content_id and status = 'published'
  ) then raise exception 'context content unavailable'; end if;

  insert into public.ai_conversations(user_id, language, context_content_id)
  values(v_user, p_language, p_context_content_id)
  returning id into v_conversation;

  insert into public.ai_messages(
    conversation_id, role, body, cited_content_ids, model_key, prompt_version,
    input_tokens, output_tokens, safety_status
  ) values
    (v_conversation, 'user', trim(p_question), '{}', null, p_prompt_version, 0, 0, 'allowed'),
    (v_conversation, 'assistant', trim(p_answer), coalesce(p_cited_content_ids, '{}'),
      left(p_model_key, 200), left(p_prompt_version, 120), greatest(coalesce(p_input_tokens, 0), 0),
      greatest(coalesce(p_output_tokens, 0), 0), 'allowed');

  return v_conversation;
end;
$$;

revoke all on function public.store_ai_exchange(text, uuid, text, text, uuid[], text, text, integer, integer) from public, anon;
grant execute on function public.store_ai_exchange(text, uuid, text, text, uuid[], text, text, integer, integer) to authenticated;

-- Separate broad Studio visibility from write authority.
create or replace function public.can_manage_catalogue()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role in ('editor', 'admin'));
$$;

create or replace function public.can_review_rights()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role in ('rights_reviewer', 'admin'));
$$;

revoke all on function public.can_manage_catalogue() from public;
grant execute on function public.can_manage_catalogue() to authenticated;
revoke all on function public.can_review_rights() from public;
grant execute on function public.can_review_rights() to authenticated;

-- Catalogue and media writes are editor/admin responsibilities.
drop policy if exists "staff categories" on public.categories;
create policy "catalogue managers categories" on public.categories for all to authenticated
  using(public.can_manage_catalogue()) with check(public.can_manage_catalogue());

drop policy if exists "staff content" on public.content_items;
create policy "catalogue managers content" on public.content_items for all to authenticated
  using(public.can_manage_catalogue()) with check(public.can_manage_catalogue());

drop policy if exists "staff playback" on public.playback_sources;
create policy "catalogue managers playback" on public.playback_sources for all to authenticated
  using(public.can_manage_catalogue()) with check(public.can_manage_catalogue());

drop policy if exists "staff collections" on public.collections;
create policy "catalogue managers collections" on public.collections for all to authenticated
  using(public.can_manage_catalogue()) with check(public.can_manage_catalogue());

drop policy if exists "staff collection items" on public.collection_items;
create policy "catalogue managers collection items" on public.collection_items for all to authenticated
  using(public.can_manage_catalogue()) with check(public.can_manage_catalogue());

drop policy if exists "staff rights read" on public.rights_records;
create policy "rights team read" on public.rights_records for select to authenticated
  using(public.can_manage_catalogue() or public.can_review_rights());

drop policy if exists "staff rights create" on public.rights_records;
create policy "rights team create" on public.rights_records for insert to authenticated
  with check(public.can_manage_catalogue() or public.can_review_rights());

drop policy if exists "reviewers rights update" on public.rights_records;
create policy "rights reviewers update" on public.rights_records for update to authenticated
  using(public.can_review_rights()) with check(public.can_review_rights());

drop policy if exists "staff media assets read" on public.media_assets;
create policy "media team assets read" on public.media_assets for select to authenticated
  using(public.can_manage_catalogue() or public.can_review_rights());

drop policy if exists "staff media assets create" on public.media_assets;
create policy "media managers assets create" on public.media_assets for insert to authenticated
  with check(public.can_manage_catalogue() and created_by = (select auth.uid()));

drop policy if exists "staff media assets update" on public.media_assets;
create policy "media managers assets update" on public.media_assets for update to authenticated
  using(public.can_manage_catalogue()) with check(public.can_manage_catalogue());

drop policy if exists "staff media jobs read" on public.media_jobs;
create policy "media team jobs read" on public.media_jobs for select to authenticated
  using(public.can_manage_catalogue() or public.can_review_rights());

drop policy if exists "staff media jobs create" on public.media_jobs;
create policy "media managers jobs create" on public.media_jobs for insert to authenticated
  with check(public.can_manage_catalogue());

commit;
