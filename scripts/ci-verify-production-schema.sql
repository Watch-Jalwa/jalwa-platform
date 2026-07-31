\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.content_items') IS NULL OR to_regclass('public.checkout_orders') IS NULL OR to_regclass('public.account_requests') IS NULL THEN
    RAISE EXCEPTION 'core production tables are missing';
  END IF;
  IF to_regprocedure('public.claim_media_job(text)') IS NULL OR to_regprocedure('public.claim_account_request(text)') IS NULL OR to_regprocedure('public.store_ai_exchange(text,uuid,text,text,uuid[],text,text,integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'controlled production functions are missing';
  END IF;
  IF has_function_privilege('authenticated', 'public.claim_media_job(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can execute claim_media_job';
  END IF;
  IF has_function_privilege('authenticated', 'public.claim_drm_packaging_job(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can execute claim_drm_packaging_job';
  END IF;
  IF has_function_privilege('authenticated', 'public.refresh_recommendation_models()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can refresh recommendation models';
  END IF;
  IF has_table_privilege('authenticated', 'public.checkout_orders', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated role can directly insert checkout orders';
  END IF;
  IF has_table_privilege('authenticated', 'public.user_devices', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated role can directly update devices';
  END IF;
  IF has_table_privilege('authenticated', 'public.ai_messages', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated role can forge AI messages';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_checkout_order(uuid,public.payment_provider,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated checkout RPC is unavailable';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.revoke_device(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated device revocation RPC is unavailable';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.claim_account_request(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privacy worker cannot claim requests';
  END IF;
END
$$;
