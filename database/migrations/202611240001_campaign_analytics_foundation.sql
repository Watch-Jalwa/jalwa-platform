begin;

-- Campaign tracking extension of the existing Jalwa Studio. No standalone admin or payment ledger.
-- Deny all direct browser SQL access; privileged server endpoints must enforce staff RBAC.
create table if not exists public.campaign_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 160),
  product text not null default 'jalwa' check (length(product) between 1 and 80),
  landing_path text not null check (landing_path like '/%' and length(landing_path) <= 180),
  source text not null check (length(source) between 1 and 80),
  utm_campaign text not null default '' check (length(utm_campaign) <= 120),
  utm_medium text not null default '' check (length(utm_medium) <= 80),
  parameter text not null default '' check (length(parameter) <= 80),
  referral text not null default '' check (length(referral) <= 80),
  creative_id text not null default '' check (length(creative_id) <= 100),
  plan_code text not null check (length(plan_code) between 1 and 80),
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_attributions (
  id uuid primary key default gen_random_uuid(),
  anonymous_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  campaign_id uuid references public.campaign_configs(id) on delete set null,
  landing_path text not null check (landing_path like '/%' and length(landing_path) <= 180),
  source text not null default 'unknown',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  legacy_utm text not null default '',
  package_code text not null default '',
  plan_code text not null default '',
  parameter text not null default '',
  referral text not null default '',
  consent_state text not null default 'unknown' check (consent_state in ('granted','denied','unknown')),
  first_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  check (expires_at > first_seen_at)
);
create index if not exists campaign_attribution_anon_idx on public.campaign_attributions(anonymous_id, first_seen_at desc);
create index if not exists campaign_attribution_user_idx on public.campaign_attributions(user_id, first_seen_at desc);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (length(event_key) between 8 and 150),
  event_name text not null check (event_name in (
    'landing_view','landing_cta','subscribe','begin_checkout',
    'jazzcash_initiated','mpin_stage_observed','payment_success','payment_failure'
  )),
  attribution_id uuid references public.campaign_attributions(id) on delete set null,
  anonymous_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text check (length(session_id) <= 120),
  order_id uuid references public.checkout_orders(id) on delete set null,
  landing_path text,
  provider_stage text check (provider_stage is null or provider_stage in ('shown','submitted','unknown')),
  source text not null default 'browser' check (source in ('browser','server','provider')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (octet_length(metadata::text) <= 2048),
  check (event_name <> 'mpin_stage_observed' or source = 'provider')
);
create index if not exists campaign_events_date_idx on public.campaign_events(occurred_at, event_name);
create index if not exists campaign_events_attribution_idx on public.campaign_events(attribution_id, occurred_at);

-- Provider payment mapping can be recorded only after verified reconciliation;
-- no client/browser may invent a paid conversion.
create table if not exists public.campaign_payment_links (
  provider public.payment_provider not null,
  remote_payment_id text not null,
  attribution_id uuid references public.campaign_attributions(id) on delete set null,
  order_id uuid references public.checkout_orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  link_source text not null check (link_source in ('verified_payment_service','verified_jazzcash')),
  linked_at timestamptz not null default now(),
  primary key (provider,remote_payment_id),
  foreign key (provider,remote_payment_id)
    references public.payment_service_payments(provider,remote_payment_id) on delete cascade
);

create table if not exists public.campaign_report_settings (
  id boolean primary key default true check(id),
  timezone text not null default 'Asia/Karachi' check (timezone = 'Asia/Karachi'),
  delivery_hour smallint not null default 9 check (delivery_hour between 0 and 23),
  delivery_minute smallint not null default 0 check (delivery_minute between 0 and 59),
  recipient_emails text[] not null default '{}',
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (coalesce(array_length(recipient_emails,1),0) <= 10)
);
insert into public.campaign_report_settings(id) values(true) on conflict do nothing;

create table if not exists public.campaign_daily_dispatches (
  report_date date not null,
  timezone text not null default 'Asia/Karachi',
  status text not null check (status in ('pending','sent','failed')),
  idempotency_key text not null unique,
  recipients text[] not null default '{}',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (report_date,timezone)
);

alter table public.campaign_configs enable row level security;
alter table public.campaign_attributions enable row level security;
alter table public.campaign_events enable row level security;
alter table public.campaign_payment_links enable row level security;
alter table public.campaign_report_settings enable row level security;
alter table public.campaign_daily_dispatches enable row level security;

revoke all on public.campaign_configs, public.campaign_attributions, public.campaign_events,
  public.campaign_payment_links, public.campaign_report_settings, public.campaign_daily_dispatches
  from public, anon, authenticated;
grant select,insert,update,delete on public.campaign_configs, public.campaign_attributions,
  public.campaign_events, public.campaign_payment_links, public.campaign_report_settings,
  public.campaign_daily_dispatches to service_role;

comment on table public.campaign_payment_links is 'Reconciled provider payment identity only. Never trust client purchase events or infer provider transaction matches from user alone.';
comment on table public.campaign_daily_dispatches is 'Idempotency marker for opt-in prior-day campaign digest, disabled by default.';

commit;
