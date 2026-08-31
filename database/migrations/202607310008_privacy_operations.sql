begin;

alter table public.account_requests drop constraint if exists account_requests_status_check;
alter table public.account_requests add constraint account_requests_status_check
  check (status in ('requested','in_review','processing','completed','failed','rejected','cancelled'));
alter table public.account_requests add column if not exists processing_attempts integer not null default 0 check (processing_attempts >= 0);
alter table public.account_requests add column if not exists max_attempts integer not null default 5 check (max_attempts between 1 and 10);
alter table public.account_requests add column if not exists available_at timestamptz not null default now();
alter table public.account_requests add column if not exists locked_at timestamptz;
alter table public.account_requests add column if not exists locked_by text;
alter table public.account_requests add column if not exists error_message text;
alter table public.account_requests add column if not exists result_storage_key text;
alter table public.account_requests add column if not exists result_expires_at timestamptz;
alter table public.account_requests add column if not exists deletion_execute_after timestamptz;
alter table public.account_requests add column if not exists cancelled_at timestamptz;
alter table public.account_requests add column if not exists subject_hash text;
alter table public.account_requests add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.account_requests drop constraint if exists account_requests_user_id_fkey;
alter table public.account_requests alter column user_id drop not null;
alter table public.account_requests add constraint account_requests_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;

-- Retain payment/audit records without retaining a live account identity.
alter table public.checkout_orders drop constraint if exists checkout_orders_user_id_fkey;
alter table public.checkout_orders alter column user_id drop not null;
alter table public.checkout_orders add constraint checkout_orders_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;

alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions alter column user_id drop not null;
alter table public.subscriptions add constraint subscriptions_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;

alter table public.entitlements drop constraint if exists entitlements_user_id_fkey;
alter table public.entitlements add constraint entitlements_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;

alter table public.audit_logs drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey foreign key(actor_id) references auth.users(id) on delete set null;

create or replace function public.schedule_account_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.request_type = 'deletion' then
    new.deletion_execute_after := coalesce(new.deletion_execute_after, now() + interval '7 days');
  end if;
  new.available_at := coalesce(new.available_at, now());
  return new;
end;
$$;

drop trigger if exists account_request_schedule_before_insert on public.account_requests;
create trigger account_request_schedule_before_insert before insert on public.account_requests
for each row execute procedure public.schedule_account_request();

drop index if exists public.account_requests_one_pending_idx;
create unique index account_requests_one_pending_idx on public.account_requests(user_id,request_type)
  where user_id is not null and status in ('requested','in_review','processing','failed');
create index if not exists account_requests_claim_idx on public.account_requests(status,available_at,requested_at);

create or replace function public.claim_account_request(p_worker_id text)
returns setof public.account_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.account_requests
  where user_id is not null
    and processing_attempts < max_attempts
    and available_at <= now()
    and (
      status in ('requested','in_review','failed')
      or (status = 'processing' and locked_at < now() - interval '30 minutes')
    )
    and (request_type = 'export' or deletion_execute_after <= now())
  order by requested_at
  for update skip locked
  limit 1;

  if v_id is null then return; end if;
  return query update public.account_requests
    set status='processing', processing_attempts=processing_attempts+1,
        locked_at=now(), locked_by=left(p_worker_id,120), error_message=null
    where id=v_id
    returning *;
end;
$$;

create or replace function public.cancel_account_deletion(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  update public.account_requests
  set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null
  where id=p_request_id and user_id=v_user and request_type='deletion'
    and status in ('requested','in_review','failed')
    and coalesce(deletion_execute_after,now()) > now();
  if not found then raise exception 'deletion request cannot be cancelled'; end if;
end;
$$;

revoke all on function public.claim_account_request(text) from public,anon,authenticated;
grant execute on function public.claim_account_request(text) to service_role;
revoke all on function public.cancel_account_deletion(uuid) from public,anon;
grant execute on function public.cancel_account_deletion(uuid) to authenticated;
revoke insert,update,delete on public.account_requests from anon,authenticated;

commit;
