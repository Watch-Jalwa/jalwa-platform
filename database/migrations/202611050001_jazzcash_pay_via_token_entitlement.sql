begin;

-- Track PayViaToken + local Premium grant for pay-first landings.
-- payment_token is server-only (table already revoked from anon/authenticated).
alter table public.jazzcash_wallet_link_intents
  add column if not exists payment_token text,
  add column if not exists charge_txn_ref text,
  add column if not exists charged_at timestamptz,
  add column if not exists charge_response_code text,
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create unique index if not exists jazzcash_wallet_link_intents_charge_txn_uidx
  on public.jazzcash_wallet_link_intents(charge_txn_ref)
  where charge_txn_ref is not null;

-- Align catalogue monthly price with public pricing page (Rs 599).
update public.prices
set amount_minor = 59900,
    duration_days = 30,
    is_active = true
where code = 'premium-monthly-pkr';

commit;
