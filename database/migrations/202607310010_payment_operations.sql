begin;

alter table public.checkout_orders
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create type public.payment_operation_kind as enum ('succeeded','failed','refunded','partially_refunded','disputed');
create type public.payment_operation_status as enum ('processed','review_required');
create type public.payment_case_status as enum ('open','resolved','dismissed');

create table public.payment_operations (
  id uuid primary key default gen_random_uuid(),
  checkout_order_id uuid not null references public.checkout_orders(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider public.payment_provider not null,
  provider_event_id text not null,
  provider_transaction_id text not null,
  operation_kind public.payment_operation_kind not null,
  processing_status public.payment_operation_status not null default 'processed',
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null,
  payload_hash text not null,
  reason text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table public.payment_exceptions (
  id uuid primary key default gen_random_uuid(),
  payment_operation_id uuid not null unique references public.payment_operations(id) on delete restrict,
  checkout_order_id uuid not null references public.checkout_orders(id) on delete restrict,
  case_kind text not null check (case_kind in ('late_failure','partial_refund','dispute','invalid_state')),
  status public.payment_case_status not null default 'open',
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null,
  reason text,
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index payment_operations_order_idx on public.payment_operations(checkout_order_id,created_at desc);
create index payment_operations_transaction_idx on public.payment_operations(provider,provider_transaction_id,created_at desc);
create index payment_exceptions_queue_idx on public.payment_exceptions(status,created_at);

alter table public.payment_operations enable row level security;
alter table public.payment_exceptions enable row level security;

revoke all on public.payment_operations from public,anon,authenticated;
revoke all on public.payment_exceptions from public,anon,authenticated;
grant select on public.payment_operations to authenticated;
grant select on public.payment_exceptions to authenticated;

create policy "finance payment operations read" on public.payment_operations
for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);

create policy "finance payment exceptions read" on public.payment_exceptions
for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);

create or replace function public.process_payment_lifecycle_event(
  p_order_id uuid,
  p_provider public.payment_provider,
  p_provider_event_id text,
  p_provider_transaction_id text,
  p_event_status text,
  p_amount_minor integer,
  p_currency text,
  p_payload_hash text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_order public.checkout_orders%rowtype;
  v_existing jsonb;
  v_subscription uuid;
  v_operation_id uuid := gen_random_uuid();
  v_processing_status public.payment_operation_status := 'processed';
  v_case_kind text;
  v_result jsonb;
begin
  if p_event_status not in ('succeeded','failed','refunded','partially_refunded','disputed') then
    raise exception 'unsupported payment event status';
  end if;
  if coalesce(char_length(p_provider_event_id),0) < 1 or coalesce(char_length(p_provider_transaction_id),0) < 1 then
    raise exception 'payment event identifiers are required';
  end if;

  select result into v_existing
  from public.payment_operations
  where provider=p_provider and provider_event_id=p_provider_event_id;
  if found then
    return v_existing || jsonb_build_object('idempotent',true);
  end if;

  select * into v_order from public.checkout_orders where id=p_order_id for update;
  if not found then raise exception 'checkout order not found'; end if;
  if v_order.provider<>p_provider then raise exception 'payment provider mismatch'; end if;
  if v_order.currency<>p_currency then raise exception 'payment currency mismatch'; end if;

  if p_event_status='partially_refunded' then
    if p_amount_minor<=0 or p_amount_minor>=v_order.amount_minor then raise exception 'partial refund amount invalid'; end if;
  elsif p_amount_minor<>v_order.amount_minor then
    raise exception 'payment amount mismatch';
  end if;

  v_subscription := v_order.subscription_id;
  if v_subscription is null then
    select s.id into v_subscription
    from public.subscriptions s
    join public.prices pr on pr.plan_id=s.plan_id
    where s.user_id=v_order.user_id and s.provider=v_order.provider and pr.id=v_order.price_id
    order by s.created_at desc limit 1;
  end if;

  if p_event_status='succeeded' then
    v_subscription := public.activate_paid_order(
      p_order_id,p_provider_event_id,p_provider_transaction_id,p_amount_minor,p_currency,p_payload_hash
    );
    update public.checkout_orders set subscription_id=v_subscription where id=v_order.id;

  elsif p_event_status='failed' then
    if v_order.status in ('created','pending','failed','expired') then
      update public.checkout_orders set status='failed' where id=v_order.id and status<>'expired';
    else
      v_processing_status := 'review_required';
      v_case_kind := 'late_failure';
    end if;
    insert into public.payment_attempts(checkout_order_id,provider_transaction_id,status,amount_minor,currency,raw_event_hash)
    values(v_order.id,p_provider_transaction_id,'failed',p_amount_minor,p_currency,p_payload_hash)
    on conflict(provider_transaction_id) do nothing;

  elsif p_event_status='partially_refunded' then
    if v_order.status not in ('succeeded','partially_refunded') then
      v_case_kind := 'invalid_state';
    else
      update public.checkout_orders set status='partially_refunded' where id=v_order.id;
      v_case_kind := 'partial_refund';
    end if;
    v_processing_status := 'review_required';

  elsif p_event_status='refunded' then
    if v_order.status not in ('succeeded','partially_refunded','refunded') then
      v_processing_status := 'review_required';
      v_case_kind := 'invalid_state';
    else
      update public.checkout_orders set status='refunded' where id=v_order.id;
      if v_subscription is not null then
        update public.subscriptions
        set status='cancelled',cancel_at_period_end=false,current_period_end=least(coalesce(current_period_end,now()),now())
        where id=v_subscription;
        update public.entitlements
        set status='revoked',ends_at=least(ends_at,now())
        where source_type='subscription' and source_id=v_subscription and status in ('active','scheduled');
      end if;
    end if;

  elsif p_event_status='disputed' then
    if v_order.status not in ('succeeded','partially_refunded','refunded','disputed') then
      v_case_kind := 'invalid_state';
    else
      update public.checkout_orders set status='disputed' where id=v_order.id;
      v_case_kind := 'dispute';
      if v_subscription is not null then
        update public.subscriptions
        set status='past_due',cancel_at_period_end=false,current_period_end=least(coalesce(current_period_end,now()),now())
        where id=v_subscription;
        update public.entitlements
        set status='revoked',ends_at=least(ends_at,now())
        where source_type='subscription' and source_id=v_subscription and status in ('active','scheduled');
      end if;
    end if;
    v_processing_status := 'review_required';
  end if;

  v_result := jsonb_build_object(
    'orderId',v_order.id,
    'subscriptionId',v_subscription,
    'eventStatus',p_event_status,
    'processingStatus',v_processing_status,
    'idempotent',false
  );

  insert into public.payment_operations(
    id,checkout_order_id,subscription_id,provider,provider_event_id,provider_transaction_id,
    operation_kind,processing_status,amount_minor,currency,payload_hash,reason,result
  ) values (
    v_operation_id,v_order.id,v_subscription,p_provider,p_provider_event_id,p_provider_transaction_id,
    p_event_status::public.payment_operation_kind,v_processing_status,p_amount_minor,p_currency,p_payload_hash,left(p_reason,1000),v_result
  );

  if v_case_kind is not null then
    insert into public.payment_exceptions(
      payment_operation_id,checkout_order_id,case_kind,amount_minor,currency,reason
    ) values (
      v_operation_id,v_order.id,v_case_kind,p_amount_minor,p_currency,left(p_reason,1000)
    );
  end if;

  update public.webhook_events
  set status='processed',processed_at=now(),error_message=null
  where provider=p_provider and provider_event_id=p_provider_event_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(null,'payment_'||p_event_status,'checkout_order',v_order.id::text,
    jsonb_build_object('provider',p_provider,'event_id',p_provider_event_id,'transaction_id',p_provider_transaction_id,
      'amount_minor',p_amount_minor,'currency',p_currency,'processing_status',v_processing_status));

  return v_result;
end;
$$;

create or replace function public.resolve_payment_exception(
  p_case_id uuid,
  p_resolution text,
  p_note text default null
) returns boolean
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_updated integer;
begin
  if not exists(select 1 from public.profiles where id=v_user and role in ('finance','admin')) then
    raise exception 'finance role required';
  end if;
  if p_resolution not in ('resolved','dismissed') then raise exception 'invalid resolution'; end if;
  if char_length(coalesce(trim(p_note),'')) < 3 then raise exception 'resolution note required'; end if;

  update public.payment_exceptions
  set status=p_resolution::public.payment_case_status,
      resolved_by=v_user,
      resolution_note=left(trim(p_note),2000),
      resolved_at=now()
  where id=p_case_id and status='open';
  get diagnostics v_updated=row_count;

  if v_updated=1 then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_user,'payment_exception_'||p_resolution,'payment_exception',p_case_id::text,jsonb_build_object('note',left(trim(p_note),2000)));
  end if;
  return v_updated=1;
end;
$$;

revoke all on function public.process_payment_lifecycle_event(uuid,public.payment_provider,text,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.process_payment_lifecycle_event(uuid,public.payment_provider,text,text,text,integer,text,text,text) to service_role;
revoke all on function public.resolve_payment_exception(uuid,text,text) from public,anon;
grant execute on function public.resolve_payment_exception(uuid,text,text) to authenticated;

commit;
