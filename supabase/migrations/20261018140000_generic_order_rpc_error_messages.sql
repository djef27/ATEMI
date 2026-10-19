-- 20261018140000_generic_order_rpc_error_messages.sql
-- Stop leaking SQL error details from get_order_receipt / get_order_tracking.
--
-- Both SECURITY DEFINER functions catch unexpected errors with
--   RAISE EXCEPTION '... : %', sqlerrm;
-- which hands the raw PostgreSQL message to the browser of an unauthenticated
-- caller (anyone holding an order_number + tracking_token).
--
-- Replayed verbatim from 20260911120000_payment_provider_and_sync.sql with the
-- exception handlers replaced by a fixed message. CREATE OR REPLACE preserves
-- ownership, grants and the REVOKE ... FROM PUBLIC already in place.
--
-- Deliberately unchanged: the explicit "commande introuvable" raises, which
-- are part of the public contract and carry no internal detail.
CREATE OR REPLACE FUNCTION public.get_order_receipt(
  p_order_number text,
  p_tracking_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
declare
    v_order record;
    v_items jsonb;
begin

    select
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_whatsapp,
        o.delivery_address,
        o.delivery_city,
        o.delivery_required,
        o.subtotal,
        o.delivery_fee,
        o.total_amount,
        o.deposit_amount,
        o.delivery_balance,
        o.status,
        o.created_at

    into v_order

    from public.orders o

    where o.order_number = trim(p_order_number)
      and o.tracking_token = p_tracking_token;

    if not found then
        raise exception
            'Commande introuvable ou reçu invalide';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total
            )
            order by oi.created_at
        ),
        '[]'::jsonb
    )
    into v_items
    from public.order_items oi
    where oi.order_id = v_order.id;

    return jsonb_build_object(
        'success', true,
        'receipt', jsonb_build_object(
            'order_number', v_order.order_number,
            'date', v_order.created_at,
            'customer', jsonb_build_object(
                'name', v_order.customer_name,
                'phone', v_order.customer_phone
            ),
            'items', v_items,
            'amounts', jsonb_build_object(
                'subtotal', v_order.subtotal,
                'delivery_fee', v_order.delivery_fee,
                'total', v_order.total_amount,
                'paid', v_order.deposit_amount,
                'remaining', v_order.delivery_balance
            ),
            'delivery', jsonb_build_object(
                'required', v_order.delivery_required,
                'city', v_order.delivery_city,
                'address', v_order.delivery_address
            ),
            'status', v_order.status
        )
    );

exception
    when others then
        -- Generic message only: the raw SQL error detail must never reach
        -- the browser of an unauthenticated caller.
        raise exception 'Erreur de génération du reçu';
end;
$fn$;

CREATE OR REPLACE FUNCTION public.get_order_tracking(
  p_order_number text,
  p_tracking_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
declare
    v_order record;
    v_items jsonb;
begin

    select
        o.id,
        o.order_number,
        o.customer_name,
        o.delivery_city,
        o.delivery_required,
        o.delivery_address,
        o.subtotal,
        o.delivery_fee,
        o.total_amount,
        o.deposit_amount,
        o.delivery_balance,
        o.status,
        o.created_at,
        o.updated_at

    into v_order

    from public.orders o

    where o.order_number = trim(p_order_number)
      and o.tracking_token = p_tracking_token;

    if not found then
        raise exception
            'Commande introuvable ou lien de suivi invalide';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total
            )
            order by oi.created_at
        ),
        '[]'::jsonb
    )
    into v_items
    from public.order_items oi
    where oi.order_id = v_order.id;

    return jsonb_build_object(
        'success', true,
        'order', jsonb_build_object(
            'order_number', v_order.order_number,
            'customer_name', v_order.customer_name,
            'items', v_items,
            'subtotal', v_order.subtotal,
            'delivery_fee', v_order.delivery_fee,
            'total_amount', v_order.total_amount,
            'deposit_amount', v_order.deposit_amount,
            'delivery_balance', v_order.delivery_balance,
            'delivery_required', v_order.delivery_required,
            'delivery_city', v_order.delivery_city,
            'delivery_address', v_order.delivery_address,
            'status', v_order.status,
            'created_at', v_order.created_at,
            'updated_at', v_order.updated_at
        )
    );

exception
    when others then
        -- Generic message only: the raw SQL error detail must never reach
        -- the browser of an unauthenticated caller.
        raise exception 'Erreur de récupération du suivi';
end;
$fn$;
-- Verification fail-loud: neither function may leak sqlerrm any more.
DO $$
DECLARE
  v_leak text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ')
  INTO v_leak
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('get_order_receipt', 'get_order_tracking')
    AND pg_get_functiondef(p.oid) LIKE '%sqlerrm%';

  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION 'FUITE sqlerrm residuelle: %', v_leak;
  END IF;
END $$;
