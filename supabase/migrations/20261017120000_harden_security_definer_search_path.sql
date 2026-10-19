-- 20261017120000_harden_security_definer_search_path.sql
-- Harden SECURITY DEFINER functions: set search_path = 'public'
-- Non-destructive, idempotent, fail-loud.
--
-- HISTORIQUE DES CORRECTIONS
-- 1. Version initiale : "DO BEGIN ... END;" sans delimiteur dollar-quoted ->
--    invalide en PostgreSQL ("syntax error at or near BEGIN"), integration
--    impossible.
-- 2. Version intermediaire : 16 blocs DO $$ ... $$ mais
--    (a) signature erronee pour create_order :
--        (text,text,text,text,text,text,uuid,boolean,text,jsonb,uuid)
--        alors que la fonction reelle est
--        (uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)
--        -> "function does not exist", avale par EXCEPTION WHEN OTHERS THEN NULL
--    (b) garde erronee pour get_order_receipt : identity arguments 'text,text'
--        alors que la fonction reelle est get_order_receipt(text, uuid)
--        -> le bloc ne s'executait jamais
--    (c) EXCEPTION WHEN OTHERS THEN NULL sur chaque bloc : echec silencieux,
--        contraire au style fail-loud du depot (cf. 20261009190000, 20261011120000)
-- 3. Version actuelle : balayage dynamique et verifie sur le catalogue
--    (pg_proc / pg_namespace), suivi d'une assertion fail-loud. Corrige
--    l'integralite des defauts precedents et detecte toute future fonction
--    SECURITY DEFINER oubliee.
--
-- Fonctions initialement visees (liste conservee pour la tracabilite) :
--   confirm_deposit_payment, create_delivery_when_ready, get_admin_order_summary,
--   get_my_role, get_my_vendor_id, get_order_receipt, get_order_tracking,
--   is_admin, is_driver, is_vendor, prepare_admin_order_notification,
--   prepare_order_notifications, prepare_vendor_order_notification,
--   trigger_order_notifications, update_delivery_status, create_order.

DO $$
DECLARE
  v_fn record;
  v_count integer := 0;
BEGIN
  FOR v_fn IN
    SELECT p.oid,
           n.nspname || '.' || p.proname
             || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
      -- Exclude functions owned by an extension (not ours to harden).
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = %L',
      v_fn.signature,
      'public'
    );
    v_count := v_count + 1;
    RAISE NOTICE 'search_path hardened: %', v_fn.signature;
  END LOOP;

  RAISE NOTICE 'SECURITY DEFINER functions hardened: %', v_count;
END $$;

-- Fail-loud : aucun SECURITY DEFINER de public ne doit rester sans search_path.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(
           n.nspname || '.' || p.proname
             || '(' || pg_get_function_identity_arguments(p.oid) || ')',
           ', '
           ORDER BY n.nspname, p.proname
         )
  INTO v_missing
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.objid = p.oid AND d.deptype = 'e'
    );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'HARDENAGE INCOMPLET : fonctions SECURITY DEFINER sans search_path: %',
      v_missing;
  END IF;
END $$;
