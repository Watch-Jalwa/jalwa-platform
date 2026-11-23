begin;

alter table public."user"
  add column if not exists "phoneNumber" text,
  add column if not exists "phoneNumberVerified" boolean default false;

create unique index if not exists better_auth_user_phone_number_uidx
  on public."user"("phoneNumber")
  where "phoneNumber" is not null;

create table if not exists public.jazzcash_wallet_link_intents (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  user_id uuid not null references public."user"(id) on delete cascade,
  msisdn text not null,
  plan_code text not null,
  landing text,
  attribution jsonb not null default '{}'::jsonb,
  status text not null default 'started'
    check (status in ('started','returned','completed','failed')),
  payment_token_present boolean not null default false,
  response_code text,
  response_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jazzcash_wallet_link_intents_user_idx
  on public.jazzcash_wallet_link_intents(user_id, created_at desc);

alter table public.checkout_orders
  add column if not exists attribution jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists premium_attribution jsonb not null default '{}'::jsonb;

revoke all on public.jazzcash_wallet_link_intents from anon, authenticated;
grant select, insert, update, delete on public.jazzcash_wallet_link_intents to service_role;

commit;
