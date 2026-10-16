-- Keep guest checkout behind the validated, rate-limited server API.
-- The API invokes create_order with the service-role client.
REVOKE ALL ON FUNCTION public.create_order(
    uuid, text, text, text, text, text, uuid, boolean, text, jsonb, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(
    uuid, text, text, text, text, text, uuid, boolean, text, jsonb, text, text
) TO service_role;

-- The vendor RLS policy still needs this helper for authenticated vendor reads,
-- but anonymous callers must not be able to probe it directly.
REVOKE ALL ON FUNCTION public.order_has_vendor_items(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_has_vendor_items(uuid, uuid) TO authenticated, service_role;

DO $$
BEGIN
    IF has_function_privilege(
        'anon',
        'public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)',
        'EXECUTE'
    ) OR has_function_privilege(
        'authenticated',
        'public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'create_order must not be executable by anon or authenticated';
    END IF;

    IF NOT has_function_privilege(
        'service_role',
        'public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'service_role must be able to execute create_order';
    END IF;

    IF has_function_privilege('anon', 'public.order_has_vendor_items(uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'order_has_vendor_items must not be executable by anon';
    END IF;

    IF NOT has_function_privilege('authenticated', 'public.order_has_vendor_items(uuid,uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.order_has_vendor_items(uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'authorized vendor reads and server operations require order_has_vendor_items';
    END IF;
END
$$;

-- get_my_vendor_id feeds every vendor RLS policy; anonymous callers must not
-- be able to probe it either.
REVOKE ALL ON FUNCTION public.get_my_vendor_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_vendor_id() TO authenticated, service_role;

DO $$
BEGIN
    IF has_function_privilege('public', 'public.get_my_vendor_id()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.get_my_vendor_id()', 'EXECUTE') THEN
        RAISE EXCEPTION 'get_my_vendor_id must not be executable by PUBLIC or anon';
    END IF;

    IF NOT has_function_privilege('authenticated', 'public.get_my_vendor_id()', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.get_my_vendor_id()', 'EXECUTE') THEN
        RAISE EXCEPTION 'vendor RLS reads and server operations require get_my_vendor_id';
    END IF;
END
$$;
