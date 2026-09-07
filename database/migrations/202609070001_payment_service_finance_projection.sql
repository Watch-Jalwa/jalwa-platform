begin;

create table public.payment_service_payments (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null default 'jazzcash',
  remote_payment_id text not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_minor integer not null check (amount_minor >= 0),
  charge_kind text check (charge_kind is null or charge_kind in ('full','step')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending','completed','failed','expired','refunded')),
  txn_ref_no text,
  response_code text,
  response_message text,
  jazzcash_rrn text,
  remote_created_at timestamptz not null,
  remote_updated_at timestamptz,
  reconciled_at timestamptz not null default now(),
  unique(provider,remote_payment_id)
);

create index payment_service_payments_user_idx
  on public.payment_service_payments(user_id,remote_created_at desc);
create index payment_service_payments_status_idx
  on public.payment_service_payments(status,remote_created_at desc);

alter table public.payment_service_payments enable row level security;
revoke all on public.payment_service_payments from public,anon,authenticated;
grant select on public.payment_service_payments to authenticated;

create policy "finance payment service payments read" on public.payment_service_payments
for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('finance','admin'))
);

comment on table public.payment_service_payments is
  'Sanitized local finance projection of authoritative payment-service payment history. No JazzCash wallet token, MPIN, merchant password or secure hash is stored.';
comment on column public.payment_service_payments.remote_payment_id is
  'Product-scoped payment-service payment identifier; unique with provider and never accepted directly from an untrusted finance mutation.';

commit;
