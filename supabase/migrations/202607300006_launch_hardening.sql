begin;

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  case_type text not null check (case_type in ('general','billing','playback','copyright','ai-safety','account')),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null check (request_type in ('export','deletion')),
  status text not null default 'requested' check (status in ('requested','in_review','completed','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  internal_note text,
  unique(user_id,request_type,status)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null check (char_length(event_name) between 2 and 80),
  path text check (char_length(path) <= 500),
  content_id uuid references public.content_items(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index support_cases_status_idx on public.support_cases(status,created_at desc);
create index support_cases_user_idx on public.support_cases(user_id,created_at desc);
create index account_requests_user_idx on public.account_requests(user_id,requested_at desc);
create index analytics_events_name_time_idx on public.analytics_events(event_name,created_at desc);
create index analytics_events_user_time_idx on public.analytics_events(user_id,created_at desc);

create trigger support_cases_touch before update on public.support_cases for each row execute procedure public.touch_updated_at();

alter table public.support_cases enable row level security;
alter table public.account_requests enable row level security;
alter table public.analytics_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy account_requests_read_own on public.account_requests
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  v_now timestamptz := now();
  v_bucket public.rate_limit_buckets%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 or char_length(p_bucket_key) < 8 then
    return false;
  end if;

  insert into public.rate_limit_buckets(bucket_key,window_started_at,request_count,updated_at)
  values(p_bucket_key,v_now,1,v_now)
  on conflict(bucket_key) do update set
    window_started_at = case
      when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now
      else public.rate_limit_buckets.window_started_at
    end,
    request_count = case
      when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1
      else public.rate_limit_buckets.request_count + 1
    end,
    updated_at = v_now
  returning * into v_bucket;

  return v_bucket.request_count <= p_limit;
end $$;

revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;

commit;
