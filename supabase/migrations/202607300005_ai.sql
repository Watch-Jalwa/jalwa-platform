begin;

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null default 'en' check (language in ('en','ur','roman_ur')),
  context_content_id uuid references public.content_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  body text not null check (length(body) between 1 and 20000),
  cited_content_ids uuid[] not null default '{}',
  model_key text,
  prompt_version text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  safety_status text not null default 'allowed' check (safety_status in ('allowed','moderated','blocked','error')),
  created_at timestamptz not null default now()
);

create table public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,usage_date,feature)
);

create index ai_conversations_user_idx on public.ai_conversations(user_id,created_at desc);
create index ai_messages_conversation_idx on public.ai_messages(conversation_id,created_at);
create index ai_usage_daily_date_idx on public.ai_usage_daily(usage_date,feature);

create trigger ai_conversations_touch before update on public.ai_conversations
for each row execute procedure public.touch_updated_at();

create or replace function public.consume_ai_quota(p_feature text,p_limit integer)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_limit < 1 or length(trim(p_feature)) < 2 then return false; end if;

  insert into public.ai_usage_daily(user_id,usage_date,feature,request_count,updated_at)
  values(v_user,current_date,trim(p_feature),1,now())
  on conflict(user_id,usage_date,feature)
  do update set request_count=public.ai_usage_daily.request_count+1,updated_at=now()
  where public.ai_usage_daily.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end
$$;

grant execute on function public.consume_ai_quota(text,integer) to authenticated;

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_daily enable row level security;

create policy "users read own ai conversations" on public.ai_conversations
for select to authenticated using(user_id=(select auth.uid()));
create policy "users create own ai conversations" on public.ai_conversations
for insert to authenticated with check(user_id=(select auth.uid()));
create policy "users delete own ai conversations" on public.ai_conversations
for delete to authenticated using(user_id=(select auth.uid()));

create policy "users read own ai messages" on public.ai_messages
for select to authenticated using(exists(
  select 1 from public.ai_conversations c
  where c.id=conversation_id and c.user_id=(select auth.uid())
));
create policy "users create own ai messages" on public.ai_messages
for insert to authenticated with check(exists(
  select 1 from public.ai_conversations c
  where c.id=conversation_id and c.user_id=(select auth.uid())
));

create policy "users read own ai usage" on public.ai_usage_daily
for select to authenticated using(user_id=(select auth.uid()));

commit;
