-- 20261017120000_harden_security_definer_search_path.sql
-- Harden SECURITY DEFINER functions: set search_path = 'public'
-- Non-destructive, idempotent.

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='confirm_deposit_payment' AND pg_get_function_identity_arguments(p.oid)='p_payment_id uuid, p_transaction_reference text, p_payment_method text') THEN
    EXECUTE 'ALTER FUNCTION public.confirm_deposit_payment(uuid,text,text) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_delivery_when_ready' AND pg_get_function_identity_arguments(oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.create_delivery_when_ready() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_admin_order_summary' AND pg_get_function_identity_arguments(p.oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.get_admin_order_summary() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_my_role' AND pg_get_function_identity_arguments(p.oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.get_my_role() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_my_vendor_id' AND pg_get_function_identity_arguments(p.oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.get_my_vendor_id() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_order_receipt' AND pg_get_function_identity_arguments(p.oid)='text,text') THEN
    EXECUTE 'ALTER FUNCTION public.get_order_receipt(text,text) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_order_tracking') THEN
    EXECUTE 'ALTER FUNCTION public.get_order_tracking(text,uuid) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_admin' AND pg_get_function_identity_arguments(p.oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_driver' AND pg_get_function_identity_arguments(p.oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.is_driver() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_vendor' AND pg_get_function_identity_arguments(p.oid)='') THEN
    EXECUTE 'ALTER FUNCTION public.is_vendor() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='prepare_admin_order_notification') THEN
    EXECUTE 'ALTER FUNCTION public.prepare_admin_order_notification(uuid) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='prepare_order_notifications') THEN
    EXECUTE 'ALTER FUNCTION public.prepare_order_notifications(uuid) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='prepare_vendor_order_notification') THEN
    EXECUTE 'ALTER FUNCTION public.prepare_vendor_order_notification(uuid) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='trigger_order_notifications') THEN
    EXECUTE 'ALTER FUNCTION public.trigger_order_notifications() SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='update_delivery_status') THEN
    EXECUTE 'ALTER FUNCTION public.update_delivery_status(uuid,text,text) SET search_path=''public''';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END ;

DO 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_order') THEN
    EXECUTE 'ALTER FUNCTION public.create_order(text,text,text,text,text,text,uuid,boolean,text,jsonb,uuid) SET search_path=''public''';
  EXCEPTION WHEN OTHERS THEN NULL; END;
END ;

