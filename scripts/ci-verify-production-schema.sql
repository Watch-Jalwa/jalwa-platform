\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.content_items') IS NULL OR to_regclass('public.checkout_orders') IS NULL OR to_regclass('public.account_requests') IS NULL THEN
    RAISE EXCEPTION 'core production tables are missing';
  END IF;
  IF to_regclass('public.payment_operations') IS NULL OR to_regclass('public.payment_exceptions') IS NULL THEN
    RAISE EXCEPTION 'payment operations tables are missing';
  END IF;
  IF to_regprocedure('public.claim_media_job(text)') IS NULL OR to_regprocedure('public.claim_account_request(text)') IS NULL OR to_regprocedure('public.store_ai_exchange(text,uuid,text,text,uuid[],text,text,integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'controlled production functions are missing';
  END IF;
  IF to_regprocedure('public.process_payment_lifecycle_event(uuid,public.payment_provider,text,text,text,integer,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'payment lifecycle function is missing';
  END IF;
  IF NOT has_schema_privilege('anon', 'extensions', 'USAGE') OR NOT has_schema_privilege('authenticated', 'extensions', 'USAGE') OR NOT has_schema_privilege('service_role', 'extensions', 'USAGE') THEN
    RAISE EXCEPTION 'runtime roles cannot use the extensions schema';
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
  IF has_function_privilege('authenticated', 'public.process_payment_lifecycle_event(uuid,public.payment_provider,text,text,text,integer,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can process provider payment events';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.process_payment_lifecycle_event(uuid,public.payment_provider,text,text,text,integer,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service role cannot process payment events';
  END IF;
  IF has_table_privilege('authenticated', 'public.checkout_orders', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated role can directly insert checkout orders';
  END IF;
  IF has_table_privilege('authenticated', 'public.payment_operations', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated role can directly mutate payment operations';
  END IF;
  IF has_table_privilege('authenticated', 'public.payment_exceptions', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated role can directly mutate payment exceptions';
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

-- Exercise the same anonymous catalogue path used by the public web runtime.
-- This catches missing pg_trgm/vector extension-schema privileges and RPC grants.
SET ROLE anon;
SELECT count(*) AS public_catalogue_probe FROM public.search_catalogue(NULL, NULL, 1);
RESET ROLE;
