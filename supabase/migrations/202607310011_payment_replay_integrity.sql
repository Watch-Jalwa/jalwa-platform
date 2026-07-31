begin;

alter function public.process_payment_lifecycle_event(
  uuid,public.payment_provider,text,text,text,integer,text,text,text
) rename to process_payment_lifecycle_event_unchecked;

revoke all on function public.process_payment_lifecycle_event_unchecked(
  uuid,public.payment_provider,text,text,text,integer,text,text,text
) from public,anon,authenticated,service_role;

create function public.process_payment_lifecycle_event(
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
  v_existing public.payment_operations%rowtype;
begin
  if coalesce(char_length(p_provider_event_id),0) < 1 then
    raise exception 'payment event identifier is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider::text || ':' || p_provider_event_id, 0)
  );

  select * into v_existing
  from public.payment_operations
  where provider=p_provider and provider_event_id=p_provider_event_id;

  if found then
    if v_existing.checkout_order_id <> p_order_id
      or v_existing.provider_transaction_id <> p_provider_transaction_id
      or v_existing.operation_kind::text <> p_event_status
      or v_existing.amount_minor <> p_amount_minor
      or v_existing.currency <> p_currency
      or v_existing.payload_hash <> p_payload_hash
    then
      raise exception 'payment event replay mismatch' using errcode='22000';
    end if;

    return v_existing.result || jsonb_build_object('idempotent',true);
  end if;

  return public.process_payment_lifecycle_event_unchecked(
    p_order_id,
    p_provider,
    p_provider_event_id,
    p_provider_transaction_id,
    p_event_status,
    p_amount_minor,
    p_currency,
    p_payload_hash,
    p_reason
  );
end;
$$;

revoke all on function public.process_payment_lifecycle_event(
  uuid,public.payment_provider,text,text,text,integer,text,text,text
) from public,anon,authenticated;
grant execute on function public.process_payment_lifecycle_event(
  uuid,public.payment_provider,text,text,text,integer,text,text,text
) to service_role;

comment on function public.process_payment_lifecycle_event(
  uuid,public.payment_provider,text,text,text,integer,text,text,text
) is 'Serializes provider event IDs and rejects conflicting webhook replays before applying payment lifecycle changes.';

commit;
