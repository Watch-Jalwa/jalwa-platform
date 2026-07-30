begin;

create type public.payment_provider as enum ('mock','payfast','jazzcash','easypaisa');
create type public.checkout_status as enum ('created','pending','succeeded','failed','expired','refunded','partially_refunded','disputed');
create type public.subscription_status as enum ('incomplete','active','past_due','cancel_at_period_end','cancelled','expired');
create type public.entitlement_status as enum ('scheduled','active','expired','revoked');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  benefits text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  code text not null unique,
  currency text not null default 'PKR',
  amount_minor integer not null check (amount_minor > 0),
  billing_period text not null check (billing_period in ('month','year','pass')),
  duration_days integer not null check (duration_days > 0),
  is_active boolean not null default true,
  provider_price_reference text,
  created_at timestamptz not null default now(),
  unique(plan_id,currency,billing_period)
);

create table public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  price_id uuid not null references public.prices(id) on delete restrict,
  amount_minor integer not null,
  currency text not null,
  provider public.payment_provider not null,
  provider_order_reference text,
  idempotency_key text not null,
  status public.checkout_status not null default 'created',
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  checkout_order_id uuid not null references public.checkout_orders(id) on delete restrict,
  provider_transaction_id text,
  status public.checkout_status not null,
  amount_minor integer not null,
  currency text not null,
  raw_event_hash text,
  created_at timestamptz not null default now(),
  unique(provider_transaction_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  signature_valid boolean not null,
  payload_hash text not null,
  status text not null default 'received' check (status in ('received','processed','rejected','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique(provider,provider_event_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider public.payment_provider not null,
  provider_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  benefit_code text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source_type text not null check (source_type in ('subscription','promotion','support')),
  source_id uuid not null,
  status public.entitlement_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,benefit_code,source_type,source_id)
);

create index checkout_orders_user_idx on public.checkout_orders(user_id,created_at desc);
create index checkout_orders_status_idx on public.checkout_orders(status,expires_at);
create index payment_attempts_order_idx on public.payment_attempts(checkout_order_id,created_at desc);
create index subscriptions_user_idx on public.subscriptions(user_id,status,current_period_end desc);
create index entitlements_user_idx on public.entitlements(user_id,benefit_code,status,ends_at desc);

create trigger plans_touch before update on public.plans for each row execute procedure public.touch_updated_at();
create trigger checkout_orders_touch before update on public.checkout_orders for each row execute procedure public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute procedure public.touch_updated_at();
create trigger entitlements_touch before update on public.entitlements for each row execute procedure public.touch_updated_at();

insert into public.plans(code,name,description,benefits) values
('premium','Jalwa Premium','Premium catalogue, enhanced playback and AI benefits.',
 array['premium_catalogue','jalwa_ads_free','enhanced_quality','ai_plus','premium_collections','early_access'])
on conflict(code) do update set name=excluded.name,description=excluded.description,benefits=excluded.benefits,is_active=true;

insert into public.prices(plan_id,code,currency,amount_minor,billing_period,duration_days)
select id,'premium-monthly-pkr','PKR',29900,'month',30 from public.plans where code='premium'
on conflict(code) do update set amount_minor=excluded.amount_minor,duration_days=excluded.duration_days,is_active=true;

insert into public.prices(plan_id,code,currency,amount_minor,billing_period,duration_days)
select id,'premium-annual-pkr','PKR',299900,'year',365 from public.plans where code='premium'
on conflict(code) do update set amount_minor=excluded.amount_minor,duration_days=excluded.duration_days,is_active=true;

create or replace function public.has_active_benefit(p_benefit text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.entitlements
    where user_id=(select auth.uid())
      and benefit_code=p_benefit
      and status='active'
      and starts_at<=now()
      and ends_at>now()
  );
$$;

create or replace function public.create_checkout_order(
  p_price_id uuid,
  p_provider public.payment_provider,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  v_price public.prices%rowtype;
  v_existing uuid;
  v_order uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if length(p_idempotency_key) < 8 or length(p_idempotency_key) > 100 then raise exception 'invalid idempotency key'; end if;

  select id into v_existing from public.checkout_orders
  where user_id=v_user and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  select * into v_price from public.prices where id=p_price_id and is_active;
  if not found then raise exception 'price unavailable'; end if;

  insert into public.checkout_orders(user_id,price_id,amount_minor,currency,provider,idempotency_key,status)
  values(v_user,v_price.id,v_price.amount_minor,v_price.currency,p_provider,p_idempotency_key,'created')
  returning id into v_order;

  return v_order;
end $$;

create or replace function public.activate_paid_order(
  p_order_id uuid,
  p_provider_event_id text,
  p_provider_transaction_id text,
  p_amount_minor integer,
  p_currency text,
  p_payload_hash text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_order public.checkout_orders%rowtype;
  v_price public.prices%rowtype;
  v_plan public.plans%rowtype;
  v_subscription uuid;
  v_start timestamptz := now();
  v_end timestamptz;
  v_benefit text;
begin
  select * into v_order from public.checkout_orders where id=p_order_id for update;
  if not found then raise exception 'checkout order not found'; end if;

  if v_order.status='succeeded' then
    select id into v_subscription from public.subscriptions
    where user_id=v_order.user_id and provider=v_order.provider
    order by created_at desc limit 1;
    return v_subscription;
  end if;

  if v_order.expires_at<now() then
    update public.checkout_orders set status='expired' where id=v_order.id;
    raise exception 'checkout expired';
  end if;

  if v_order.amount_minor<>p_amount_minor or v_order.currency<>p_currency then
    update public.checkout_orders set status='failed' where id=v_order.id;
    raise exception 'payment amount mismatch';
  end if;

  select * into v_price from public.prices where id=v_order.price_id;
  select * into v_plan from public.plans where id=v_price.plan_id;
  v_end := v_start + make_interval(days=>v_price.duration_days);

  insert into public.payment_attempts(checkout_order_id,provider_transaction_id,status,amount_minor,currency,raw_event_hash)
  values(v_order.id,p_provider_transaction_id,'succeeded',p_amount_minor,p_currency,p_payload_hash)
  on conflict(provider_transaction_id) do nothing;

  update public.checkout_orders set status='succeeded',provider_order_reference=coalesce(provider_order_reference,p_provider_transaction_id)
  where id=v_order.id;

  select id into v_subscription from public.subscriptions
  where user_id=v_order.user_id and plan_id=v_plan.id and status in ('active','cancel_at_period_end')
  order by current_period_end desc nulls last limit 1 for update;

  if v_subscription is null then
    insert into public.subscriptions(user_id,plan_id,provider,status,current_period_start,current_period_end)
    values(v_order.user_id,v_plan.id,v_order.provider,'active',v_start,v_end)
    returning id into v_subscription;
  else
    update public.subscriptions
    set status='active',
        current_period_start=least(coalesce(current_period_start,v_start),v_start),
        current_period_end=greatest(coalesce(current_period_end,v_start),v_start)+make_interval(days=>v_price.duration_days),
        cancel_at_period_end=false
    where id=v_subscription
    returning current_period_end into v_end;
  end if;

  foreach v_benefit in array v_plan.benefits loop
    insert into public.entitlements(user_id,benefit_code,starts_at,ends_at,source_type,source_id,status)
    values(v_order.user_id,v_benefit,v_start,v_end,'subscription',v_subscription,'active')
    on conflict(user_id,benefit_code,source_type,source_id)
    do update set starts_at=least(public.entitlements.starts_at,excluded.starts_at),
                  ends_at=greatest(public.entitlements.ends_at,excluded.ends_at),
                  status='active';
  end loop;

  update public.webhook_events
  set status='processed',processed_at=now()
  where provider=v_order.provider and provider_event_id=p_provider_event_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_order.user_id,'payment_succeeded','checkout_order',v_order.id::text,
    jsonb_build_object('provider',v_order.provider,'amount_minor',p_amount_minor,'currency',p_currency));

  return v_subscription;
end $$;

revoke all on function public.activate_paid_order(uuid,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.activate_paid_order(uuid,text,text,integer,text,text) to service_role;
grant execute on function public.create_checkout_order(uuid,public.payment_provider,text) to authenticated;
grant execute on function public.has_active_benefit(text) to authenticated;

alter table public.plans enable row level security;
alter table public.prices enable row level security;
alter table public.checkout_orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;

create policy "plans public read" on public.plans for select using(is_active);
create policy "prices public read" on public.prices for select using(is_active);
create policy "orders own read" on public.checkout_orders for select to authenticated using(user_id=(select auth.uid()));
create policy "orders own insert" on public.checkout_orders for insert to authenticated with check(user_id=(select auth.uid()));
create policy "payments own read" on public.payment_attempts for select to authenticated using(
  exists(select 1 from public.checkout_orders o where o.id=checkout_order_id and o.user_id=(select auth.uid()))
);
create policy "subscriptions own read" on public.subscriptions for select to authenticated using(user_id=(select auth.uid()));
create policy "entitlements own read" on public.entitlements for select to authenticated using(user_id=(select auth.uid()));
create policy "finance orders read" on public.checkout_orders for select to authenticated using(
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);
create policy "finance payments read" on public.payment_attempts for select to authenticated using(
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);
create policy "finance subscriptions read" on public.subscriptions for select to authenticated using(
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);
create policy "finance webhook read" on public.webhook_events for select to authenticated using(
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);

commit;
