begin;

insert into public.payment_refunds(
  payment_operation_id,checkout_order_id,subscription_id,provider,provider_event_id,
  provider_transaction_id,refund_kind,amount_minor,currency,reason,refunded_at
)
select o.id,o.checkout_order_id,o.subscription_id,o.provider,o.provider_event_id,
       o.provider_transaction_id,
       case when o.operation_kind='refunded' then 'full' else 'partial' end,
       o.amount_minor,o.currency,o.reason,o.created_at
from public.payment_operations o
where o.operation_kind in ('refunded','partially_refunded')
on conflict(payment_operation_id) do nothing;

revoke all on function public.populate_checkout_reporting_fields() from public,anon,authenticated;
revoke all on function public.populate_subscription_reporting_fields() from public,anon,authenticated;
revoke all on function public.record_subscription_status_event() from public,anon,authenticated;
revoke all on function public.capture_payment_refund() from public,anon,authenticated;
revoke all on function public.link_subscription_reporting_snapshot() from public,anon,authenticated;

commit;
