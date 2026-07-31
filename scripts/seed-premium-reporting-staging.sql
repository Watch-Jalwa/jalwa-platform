\set ON_ERROR_STOP on
\if :{?deployment_environment}
\else
  \echo 'deployment_environment is required'
  \quit 1
\endif
\if :{?fixture_user_id}
\else
  \echo 'fixture_user_id is required'
  \quit 1
\endif
\if :{?fixture_user_id_2}
\else
  \echo 'fixture_user_id_2 is required'
  \quit 1
\endif
\if :{?fixture_user_id_3}
\else
  \echo 'fixture_user_id_3 is required'
  \quit 1
\endif

select set_config('app.environment', :'deployment_environment', false);
select set_config('app.fixture_user_id', :'fixture_user_id', false);
select set_config('app.fixture_user_id_2', :'fixture_user_id_2', false);
select set_config('app.fixture_user_id_3', :'fixture_user_id_3', false);

do $$
declare
  v_user1 uuid := current_setting('app.fixture_user_id')::uuid;
  v_user2 uuid := current_setting('app.fixture_user_id_2')::uuid;
  v_user3 uuid := current_setting('app.fixture_user_id_3')::uuid;
  v_plan uuid;
  v_price uuid;
  v_subscription1 uuid := gen_random_uuid();
  v_subscription2 uuid := gen_random_uuid();
  v_manual_subscription uuid := gen_random_uuid();
  v_activation uuid := gen_random_uuid();
  v_renewal uuid := gen_random_uuid();
  v_failed_renewal uuid := gen_random_uuid();
  v_failed_activation uuid := gen_random_uuid();
  v_pending uuid := gen_random_uuid();
  v_refund_operation uuid := gen_random_uuid();
begin
  if current_setting('app.environment',true) <> 'staging' then
    raise exception 'Premium reporting fixtures may run only in staging';
  end if;
  if not exists(select 1 from auth.users where id=v_user1)
     or not exists(select 1 from auth.users where id=v_user2)
     or not exists(select 1 from auth.users where id=v_user3) then
    raise exception 'All fixture users must already exist in auth.users';
  end if;

  select p.id,pr.id into v_plan,v_price
  from public.plans p join public.prices pr on pr.plan_id=p.id
  where p.code='premium' and pr.billing_period='month' and pr.is_active
  order by pr.created_at limit 1;
  if v_price is null then raise exception 'Active Premium monthly price is required'; end if;

  delete from public.payment_exceptions
  where checkout_order_id in (select id from public.checkout_orders where idempotency_key like 'staging-report-%')
     or reason like 'STAGING_REPORT_FIXTURE:%';
  delete from public.payment_refunds
  where checkout_order_id in (select id from public.checkout_orders where idempotency_key like 'staging-report-%');
  delete from public.payment_operations
  where checkout_order_id in (select id from public.checkout_orders where idempotency_key like 'staging-report-%')
     or reason like 'STAGING_REPORT_FIXTURE:%';
  delete from public.payment_attempts where provider_transaction_id like 'staging-report-%';
  delete from public.checkout_orders where idempotency_key like 'staging-report-%';
  delete from public.subscriptions where user_id in (v_user1,v_user2,v_user3) and provider='mock';

  insert into public.subscriptions(id,user_id,plan_id,provider,status,current_period_start,current_period_end,activation_source,activated_at,renewal_due_at)
  values
    (v_subscription1,v_user1,v_plan,'mock','cancel_at_period_end',now()-interval '40 days',now()+interval '20 days','paid',now()-interval '40 days',now()+interval '20 days'),
    (v_subscription2,v_user2,v_plan,'mock','past_due',now()-interval '30 days',now()-interval '1 day','paid',now()-interval '30 days',now()-interval '1 day'),
    (v_manual_subscription,v_user3,v_plan,'mock','active',now()-interval '5 days',now()+interval '25 days','manual_grant',now()-interval '5 days',now()+interval '25 days');

  update public.subscriptions set cancel_at_period_end=true,cancellation_requested_at=now()-interval '2 days' where id=v_subscription1;
  update public.subscriptions set auto_renew_consented=true,auto_renew_consented_at=now()-interval '10 days',grace_ends_at=now()+interval '3 days' where id=v_subscription2;

  insert into public.checkout_orders(id,user_id,price_id,subscription_id,amount_minor,currency,provider,provider_order_reference,idempotency_key,status,payment_purpose,created_at,initiated_at,completed_at)
  values
    (v_activation,v_user1,v_price,v_subscription1,29900,'PKR','mock','staging-report-activation','staging-report-activation','succeeded','activation',now()-interval '35 days',now()-interval '35 days',now()-interval '35 days'),
    (v_renewal,v_user1,v_price,v_subscription1,29900,'PKR','mock','staging-report-renewal','staging-report-renewal','partially_refunded','renewal',now()-interval '5 days',now()-interval '5 days',now()-interval '5 days'),
    (v_failed_renewal,v_user2,v_price,v_subscription2,29900,'PKR','mock','staging-report-failed-renewal','staging-report-failed-renewal','failed','renewal',now()-interval '2 days',now()-interval '2 days',null),
    (v_failed_activation,v_user3,v_price,null,29900,'PKR','mock','staging-report-failed-activation','staging-report-failed-activation','failed','activation',now()-interval '3 days',now()-interval '3 days',null),
    (v_pending,v_user3,v_price,null,29900,'PKR','mock','staging-report-pending','staging-report-pending','pending','activation',now()-interval '4 hours',now()-interval '4 hours',null);

  update public.checkout_orders set failed_at=created_at,provider_status='failed' where id in (v_failed_renewal,v_failed_activation);
  update public.checkout_orders set provider_status='pending' where id=v_pending;

  insert into public.payment_attempts(checkout_order_id,provider_transaction_id,status,amount_minor,currency,raw_event_hash,created_at)
  values
    (v_activation,'staging-report-activation-tx','succeeded',29900,'PKR','fixture',now()-interval '35 days'),
    (v_renewal,'staging-report-renewal-tx','succeeded',29900,'PKR','fixture',now()-interval '5 days'),
    (v_failed_renewal,'staging-report-failed-renewal-tx','failed',29900,'PKR','fixture',now()-interval '2 days'),
    (v_failed_activation,'staging-report-failed-activation-tx','failed',29900,'PKR','fixture',now()-interval '3 days');

  insert into public.payment_operations(id,checkout_order_id,subscription_id,provider,provider_event_id,provider_transaction_id,operation_kind,processing_status,amount_minor,currency,payload_hash,reason,result,created_at)
  values(v_refund_operation,v_renewal,v_subscription1,'mock','staging-report-partial-refund-event','staging-report-renewal-tx','partially_refunded','review_required',9900,'PKR','fixture','STAGING_REPORT_FIXTURE: partial refund','{}',now()-interval '1 day');

  insert into public.payment_exceptions(payment_operation_id,checkout_order_id,case_kind,status,amount_minor,currency,reason,created_at)
  values(v_refund_operation,v_renewal,'partial_refund','open',9900,'PKR','STAGING_REPORT_FIXTURE: partial refund needs review',now()-interval '1 day')
  on conflict(payment_operation_id) do nothing;

  insert into public.webhook_events(provider,provider_event_id,signature_valid,payload_hash,status,received_at,error_message)
  values('mock','staging-report-failed-webhook',true,'fixture','failed',now()-interval '1 hour','STAGING_REPORT_FIXTURE: ignored webhook')
  on conflict(provider,provider_event_id) do update set status='failed',received_at=excluded.received_at,error_message=excluded.error_message;
end;
$$;
