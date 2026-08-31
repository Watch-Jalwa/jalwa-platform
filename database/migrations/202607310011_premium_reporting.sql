begin;

alter table public.checkout_orders
  add column if not exists payment_purpose text not null default 'unknown',
  add column if not exists plan_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists price_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists provider_status text,
  add column if not exists initiated_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists reconciliation_state text not null default 'matched',
  add column if not exists attention_reason text;

alter table public.checkout_orders
  drop constraint if exists checkout_orders_payment_purpose_check,
  add constraint checkout_orders_payment_purpose_check check (payment_purpose in ('activation','renewal','unknown')),
  drop constraint if exists checkout_orders_reconciliation_state_check,
  add constraint checkout_orders_reconciliation_state_check check (reconciliation_state in ('matched','attention','resolved'));

alter table public.subscriptions
  add column if not exists activation_source text not null default 'paid',
  add column if not exists activated_at timestamptz,
  add column if not exists renewal_due_at timestamptz,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists auto_renew_consented boolean not null default false,
  add column if not exists auto_renew_consented_at timestamptz,
  add column if not exists plan_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists price_snapshot jsonb not null default '{}'::jsonb;

alter table public.subscriptions
  drop constraint if exists subscriptions_activation_source_check,
  add constraint subscriptions_activation_source_check check (activation_source in ('paid','manual_grant'));

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_operation_id uuid not null unique references public.payment_operations(id) on delete restrict,
  checkout_order_id uuid not null references public.checkout_orders(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider public.payment_provider not null,
  provider_event_id text not null,
  provider_transaction_id text not null,
  refund_kind text not null check (refund_kind in ('full','partial')),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  reason text,
  refunded_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table if not exists public.subscription_status_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status public.subscription_status not null,
  activation_source text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null,
  grace_ends_at timestamptz,
  occurred_at timestamptz not null default now()
);

create or replace function public.populate_checkout_reporting_fields()
returns trigger
language plpgsql
security definer set search_path=''
as $$
declare
  v_price public.prices%rowtype;
  v_plan public.plans%rowtype;
begin
  select * into v_price from public.prices where id=new.price_id;
  if found then
    select * into v_plan from public.plans where id=v_price.plan_id;
    if new.plan_snapshot='{}'::jsonb then
      new.plan_snapshot := jsonb_build_object(
        'id',v_plan.id,'code',v_plan.code,'name',v_plan.name,'benefits',v_plan.benefits
      );
    end if;
    if new.price_snapshot='{}'::jsonb then
      new.price_snapshot := jsonb_build_object(
        'id',v_price.id,'code',v_price.code,'currency',v_price.currency,
        'amountMinor',v_price.amount_minor,'billingPeriod',v_price.billing_period,
        'durationDays',v_price.duration_days
      );
    end if;
    if tg_op='INSERT' and new.payment_purpose='unknown' then
      new.payment_purpose := case when exists(
        select 1 from public.subscriptions s
        where s.user_id=new.user_id and s.plan_id=v_plan.id and s.activation_source='paid'
      ) then 'renewal' else 'activation' end;
    end if;
  end if;

  if new.status='pending' and new.initiated_at is null then new.initiated_at := now(); end if;
  if new.status='succeeded' and new.completed_at is null then new.completed_at := now(); end if;
  if new.status='failed' and new.failed_at is null then new.failed_at := now(); end if;
  new.provider_status := coalesce(new.provider_status,new.status::text);

  if new.status='succeeded' and new.subscription_id is null then
    new.reconciliation_state := 'attention';
    new.attention_reason := coalesce(new.attention_reason,'Completed payment is not linked to a subscription.');
  elsif new.status='succeeded' and new.subscription_id is not null then
    new.reconciliation_state := 'matched';
    new.attention_reason := null;
  elsif new.status in ('refunded','disputed') and new.subscription_id is null then
    new.reconciliation_state := 'attention';
    new.attention_reason := coalesce(new.attention_reason,'Reversal is not linked to a subscription.');
  end if;

  return new;
end;
$$;

drop trigger if exists checkout_reporting_fields_before_write on public.checkout_orders;
create trigger checkout_reporting_fields_before_write
before insert or update on public.checkout_orders
for each row execute procedure public.populate_checkout_reporting_fields();

create or replace function public.populate_subscription_reporting_fields()
returns trigger
language plpgsql
security definer set search_path=''
as $$
declare
  v_plan public.plans%rowtype;
begin
  select * into v_plan from public.plans where id=new.plan_id;
  if found and new.plan_snapshot='{}'::jsonb then
    new.plan_snapshot := jsonb_build_object(
      'id',v_plan.id,'code',v_plan.code,'name',v_plan.name,'benefits',v_plan.benefits
    );
  end if;
  if new.activated_at is null and new.status in ('active','past_due','cancel_at_period_end') then
    new.activated_at := coalesce(new.current_period_start,new.created_at,now());
  end if;
  if new.current_period_end is not null then new.renewal_due_at := new.current_period_end; end if;
  if tg_op='UPDATE' and new.cancel_at_period_end and not old.cancel_at_period_end then
    new.cancellation_requested_at := coalesce(new.cancellation_requested_at,now());
  end if;
  if new.status='cancelled' then new.cancelled_at := coalesce(new.cancelled_at,now()); end if;
  if new.status='expired' then new.expired_at := coalesce(new.expired_at,now()); end if;
  if not new.auto_renew_consented then new.auto_renew_consented_at := null;
  elsif new.auto_renew_consented_at is null then new.auto_renew_consented_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_reporting_fields_before_write on public.subscriptions;
create trigger subscription_reporting_fields_before_write
before insert or update on public.subscriptions
for each row execute procedure public.populate_subscription_reporting_fields();

create or replace function public.record_subscription_status_event()
returns trigger
language plpgsql
security definer set search_path=''
as $$
begin
  if tg_op='INSERT'
     or new.status is distinct from old.status
     or new.current_period_start is distinct from old.current_period_start
     or new.current_period_end is distinct from old.current_period_end
     or new.cancel_at_period_end is distinct from old.cancel_at_period_end
     or new.grace_ends_at is distinct from old.grace_ends_at then
    insert into public.subscription_status_events(
      subscription_id,user_id,plan_id,status,activation_source,current_period_start,
      current_period_end,cancel_at_period_end,grace_ends_at,occurred_at
    ) values (
      new.id,new.user_id,new.plan_id,new.status,new.activation_source,new.current_period_start,
      new.current_period_end,new.cancel_at_period_end,new.grace_ends_at,now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_status_event_after_write on public.subscriptions;
create trigger subscription_status_event_after_write
after insert or update on public.subscriptions
for each row execute procedure public.record_subscription_status_event();

create or replace function public.capture_payment_refund()
returns trigger
language plpgsql
security definer set search_path=''
as $$
begin
  if new.operation_kind in ('refunded','partially_refunded') then
    insert into public.payment_refunds(
      payment_operation_id,checkout_order_id,subscription_id,provider,provider_event_id,
      provider_transaction_id,refund_kind,amount_minor,currency,reason,refunded_at
    ) values (
      new.id,new.checkout_order_id,new.subscription_id,new.provider,new.provider_event_id,
      new.provider_transaction_id,
      case when new.operation_kind='refunded' then 'full' else 'partial' end,
      new.amount_minor,new.currency,new.reason,new.created_at
    ) on conflict(payment_operation_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_refund_after_operation on public.payment_operations;
create trigger payment_refund_after_operation
after insert on public.payment_operations
for each row execute procedure public.capture_payment_refund();

create or replace function public.link_subscription_reporting_snapshot()
returns trigger
language plpgsql
security definer set search_path=''
as $$
begin
  if new.status='succeeded' and new.subscription_id is not null then
    update public.subscriptions
    set plan_snapshot=case when plan_snapshot='{}'::jsonb then new.plan_snapshot else plan_snapshot end,
        price_snapshot=case when price_snapshot='{}'::jsonb then new.price_snapshot else price_snapshot end,
        activated_at=coalesce(activated_at,new.completed_at,new.created_at),
        renewal_due_at=current_period_end
    where id=new.subscription_id;
  end if;
  return new;
end;
$$;

drop trigger if exists checkout_subscription_snapshot_after_write on public.checkout_orders;
create trigger checkout_subscription_snapshot_after_write
after insert or update on public.checkout_orders
for each row execute procedure public.link_subscription_reporting_snapshot();

update public.checkout_orders o
set plan_snapshot=jsonb_build_object('id',pl.id,'code',pl.code,'name',pl.name,'benefits',pl.benefits),
    price_snapshot=jsonb_build_object('id',p.id,'code',p.code,'currency',p.currency,'amountMinor',p.amount_minor,
      'billingPeriod',p.billing_period,'durationDays',p.duration_days),
    provider_status=coalesce(o.provider_status,o.status::text),
    initiated_at=case when o.status<>'created' then coalesce(o.initiated_at,o.created_at) else o.initiated_at end,
    completed_at=case when o.status in ('succeeded','refunded','partially_refunded','disputed') then coalesce(o.completed_at,o.updated_at) else o.completed_at end,
    failed_at=case when o.status='failed' then coalesce(o.failed_at,o.updated_at) else o.failed_at end
from public.prices p
join public.plans pl on pl.id=p.plan_id
where o.price_id=p.id;

update public.subscriptions s
set activated_at=coalesce(s.activated_at,s.current_period_start,s.created_at),
    renewal_due_at=coalesce(s.renewal_due_at,s.current_period_end),
    cancellation_requested_at=case when s.cancel_at_period_end then coalesce(s.cancellation_requested_at,s.updated_at) else s.cancellation_requested_at end,
    cancelled_at=case when s.status='cancelled' then coalesce(s.cancelled_at,s.updated_at) else s.cancelled_at end,
    expired_at=case when s.status='expired' then coalesce(s.expired_at,s.updated_at) else s.expired_at end,
    plan_snapshot=jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'benefits',p.benefits)
from public.plans p
where s.plan_id=p.id;

insert into public.subscription_status_events(
  subscription_id,user_id,plan_id,status,activation_source,current_period_start,current_period_end,
  cancel_at_period_end,grace_ends_at,occurred_at
)
select s.id,s.user_id,s.plan_id,s.status,s.activation_source,s.current_period_start,s.current_period_end,
       s.cancel_at_period_end,s.grace_ends_at,coalesce(s.updated_at,s.created_at)
from public.subscriptions s
where not exists(select 1 from public.subscription_status_events e where e.subscription_id=s.id);

create index if not exists checkout_orders_reporting_completed_idx
  on public.checkout_orders(completed_at desc,status,payment_purpose,price_id,user_id);
create index if not exists checkout_orders_reporting_created_idx
  on public.checkout_orders(created_at desc,status,payment_purpose,provider);
create index if not exists checkout_orders_reporting_reconciliation_idx
  on public.checkout_orders(reconciliation_state,created_at desc);
create index if not exists checkout_orders_provider_reference_idx
  on public.checkout_orders(provider_order_reference);
create index if not exists payment_attempts_reporting_idx
  on public.payment_attempts(created_at desc,status,checkout_order_id);
create index if not exists payment_refunds_reporting_idx
  on public.payment_refunds(refunded_at desc,checkout_order_id,subscription_id);
create index if not exists subscriptions_reporting_status_idx
  on public.subscriptions(status,current_period_end,renewal_due_at,user_id);
create index if not exists subscription_status_events_reporting_idx
  on public.subscription_status_events(occurred_at desc,status,subscription_id);

alter table public.payment_refunds enable row level security;
alter table public.subscription_status_events enable row level security;

revoke all on public.payment_refunds from public,anon,authenticated;
revoke all on public.subscription_status_events from public,anon,authenticated;
grant select on public.payment_refunds to authenticated;
grant select on public.subscription_status_events to authenticated;

create policy "finance payment refunds read" on public.payment_refunds
for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);

create policy "finance subscription events read" on public.subscription_status_events
for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);

commit;
