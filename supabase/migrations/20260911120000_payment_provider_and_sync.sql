-- ============================================================================
-- 20260911120000_payment_provider_and_sync.sql
--
-- OBJECTIFS
--   1. Traçabilité : create_order enregistre le VRAI provider de paiement
--      (et non la valeur par défaut 'mock' de la colonne). Un paramètre
--      optionnel final p_provider est ajouté (compatible CREATE OR REPLACE :
--      tous les appels existants restent valides).
--   2. Synchronisation : get_order_receipt / get_order_tracking n'existaient
--      QUE dans la base distante (et le backup), pas dans supabase/migrations/.
--      Elles sont rejouées ici pour qu'une base fraîche fonctionne.
--
-- Idempotence : CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS + DROP IF EXISTS.
-- Aucune migration existante n'est modifiée.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. create_order AVEC p_provider (traçabilité réelle du prestataire)
--    Ancêtres à signature incomplète supprimés pour éviter toute ambiguïté
--    PostgREST (même pattern que 20260831200000_fix_create_order_ambiguity).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb);
DROP FUNCTION IF EXISTS public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text);

CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_id       uuid    DEFAULT NULL::uuid,
  p_customer_name     text    DEFAULT NULL::text,
  p_customer_phone    text    DEFAULT NULL::text,
  p_customer_whatsapp text    DEFAULT NULL::text,
  p_delivery_address  text    DEFAULT NULL::text,
  p_delivery_city     text    DEFAULT NULL::text,
  p_delivery_zone_id  uuid    DEFAULT NULL::uuid,
  p_delivery_required boolean DEFAULT true,
  p_customer_notes    text    DEFAULT NULL::text,
  p_items             jsonb   DEFAULT '[]'::jsonb,
  p_customer_email    text    DEFAULT NULL::text,
  p_provider          text    DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$

declare
    v_order_id uuid;
    v_order_number text;

    v_subtotal numeric := 0;
    v_delivery_fee numeric := 0;
    v_total numeric := 0;
    v_deposit numeric := 0;
    v_delivery_balance numeric := 0;

    v_item jsonb;
    v_product record;

    v_quantity integer;
    v_line_total numeric;
    v_item_deposit numeric;

    v_customer_id uuid;

    v_provider text;

begin

    v_provider := nullif(trim(coalesce(p_provider, 'mock')), '');

    if p_customer_name is null
       or trim(p_customer_name) = '' then
        raise exception 'Le nom du client est obligatoire';
    end if;

    if p_customer_phone is null
       or trim(p_customer_phone) = '' then
        raise exception 'Le numero de telephone est obligatoire';
    end if;

    if p_delivery_required then

        if p_delivery_address is null
           or trim(p_delivery_address) = '' then
            raise exception 'L''adresse de livraison est obligatoire';
        end if;

        if p_delivery_city is null
           or trim(p_delivery_city) = '' then
            raise exception 'La ville de livraison est obligatoire';
        end if;

        if p_delivery_zone_id is null then
            raise exception 'La zone de livraison est obligatoire';
        end if;

    end if;

    if auth.uid() is not null then
        v_customer_id := auth.uid();
    else
        v_customer_id := p_customer_id;
    end if;

    if p_items is null
       or jsonb_array_length(p_items) = 0 then
        raise exception 'Le panier est vide';
    end if;

    for v_item in
        select value
        from jsonb_array_elements(p_items)
    loop

        v_quantity :=
            coalesce(
                (v_item ->> 'quantity')::integer,
                0
            );

        if v_quantity <= 0 then
            raise exception 'Quantite invalide';
        end if;

        select
            p.id,
            p.vendor_id,
            p.name,
            p.selling_price,
            p.stock,
            p.status,
            p.deposit_rate

        into v_product

        from public.products p

        where p.id = (v_item ->> 'product_id')::uuid

        for update;

        if not found then
            raise exception
                'Produit introuvable : %',
                v_item ->> 'product_id';
        end if;

        if v_product.status <> 'active' then
            raise exception
                'Le produit "%" n''est plus disponible',
                v_product.name;
        end if;

        if v_product.stock < v_quantity then
            raise exception
                'Stock insuffisant pour "%"',
                v_product.name;
        end if;

        v_line_total :=
            v_product.selling_price * v_quantity;

        v_item_deposit :=
            round(v_product.selling_price * v_product.deposit_rate / 100, 2) * v_quantity;

        v_subtotal :=
            v_subtotal + v_line_total;

        v_deposit :=
            v_deposit + v_item_deposit;

    end loop;

    if p_delivery_required then

        select delivery_fee
        into v_delivery_fee

        from public.delivery_zones

        where id = p_delivery_zone_id
          and is_available = true;

        if not found then
            raise exception
                'Zone de livraison indisponible';
        end if;

    else

        v_delivery_fee := 0;

    end if;

    v_total :=
        v_subtotal + v_delivery_fee;

    -- FIX (audit 2026-09-30): delivery_balance DOIT inclure les frais de
    -- livraison, sinon total_amount != deposit_amount + delivery_balance et la
    -- contrainte orders_total_split_check rejette TOUTE commande livree.
    -- Cf. 20260902100000_fix_delivery_balance_check_constraint.sql.
    v_delivery_balance :=
        v_total - v_deposit;

    v_order_number :=
        'CMD-' ||
        to_char(now(), 'YYYYMMDD-HH24MISS') ||
        '-' ||
        upper(
            substr(
                replace(gen_random_uuid()::text, '-', ''),
                1,
                6
            )
        );

    insert into public.orders (

        order_number,
        customer_id,

        customer_name,
        customer_phone,
        customer_whatsapp,
        customer_email,

        delivery_address,
        delivery_city,
        delivery_zone_id,
        delivery_required,

        subtotal,
        delivery_fee,
        total_amount,

        deposit_amount,
        delivery_balance,

        status,
        customer_notes

    )

    values (

        v_order_number,
        v_customer_id,

        trim(p_customer_name),
        trim(p_customer_phone),
        nullif(trim(p_customer_whatsapp), ''),
        nullif(lower(trim(p_customer_email)), ''),

        case
            when p_delivery_required
            then trim(p_delivery_address)
            else null
        end,

        case
            when p_delivery_required
            then trim(p_delivery_city)
            else null
        end,

        case
            when p_delivery_required
            then p_delivery_zone_id
            else null
        end,

        p_delivery_required,

        v_subtotal,
        v_delivery_fee,
        v_total,

        v_deposit,
        v_delivery_balance,

        'pending_payment',
        nullif(trim(p_customer_notes), '')

    )

    returning id, order_number
    into v_order_id, v_order_number;

    for v_item in
        select value
        from jsonb_array_elements(p_items)
    loop

        v_quantity :=
            (v_item ->> 'quantity')::integer;

        select
            p.id,
            p.vendor_id,
            p.name,
            p.selling_price,
            p.deposit_rate

        into v_product

        from public.products p

        where p.id = (v_item ->> 'product_id')::uuid;

        v_line_total :=
            v_product.selling_price * v_quantity;

        v_item_deposit :=
            round(v_product.selling_price * v_product.deposit_rate / 100, 2) * v_quantity;

        insert into public.order_items (

            order_id,
            product_id,
            vendor_id,

            product_name,
            quantity,

            unit_price,
            line_total,

            deposit_rate_snapshot,
            deposit_amount_snapshot,
            remaining_amount_snapshot

        )

        values (

            v_order_id,
            v_product.id,
            v_product.vendor_id,

            v_product.name,
            v_quantity,

            v_product.selling_price,
            v_line_total,

            v_product.deposit_rate,
            v_item_deposit,
            v_line_total - v_item_deposit

        );

        update public.products

        set
            stock = stock - v_quantity,
            updated_at = now()

        where id = v_product.id;

    end loop;

    insert into public.payments (

        order_id,
        payment_type,
        amount,
        currency,
        status,
        payment_method,
        provider

    )

    values (

        v_order_id,
        'deposit',
        v_deposit,
        'XOF',
        'pending',
        null,
        v_provider

    );

    insert into public.order_status_history (

        order_id,
        old_status,
        new_status,
        changed_by,
        note

    )

    values (

        v_order_id,
        null,
        'pending_payment',
        v_customer_id,
        'Commande creee. En attente de confirmation du paiement initial.'

    );

    return jsonb_build_object(

        'success', true,

        'order_id', v_order_id,

        'order_number', v_order_number,

        'tracking_token', (select tracking_token from public.orders where id = v_order_id),

        'subtotal', v_subtotal,

        'delivery_fee', v_delivery_fee,

        'total_amount', v_total,

        'deposit_amount', v_deposit,

        'delivery_balance', v_delivery_balance,

        'payment_status', 'pending',

        'order_status', 'pending_payment'

    );

exception

    when others then

        raise exception
            'Erreur creation commande : %',
            sqlerrm;

end;

$function$;

GRANT EXECUTE ON FUNCTION public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb,text,text) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 2. get_order_receipt — rejouée depuis l'état distant (forme attendue par
--    src/app/recu/page.tsx et src/app/paiement/page.tsx).
-- ----------------------------------------------------------------------------
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
        raise exception
            'Erreur génération reçu : %',
            sqlerrm;
end;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_order_receipt(text, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_order_receipt(text, uuid) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 3. get_order_tracking — rejouée depuis l'état distant (forme attendue par
--    src/app/suivi/page.tsx).
-- ----------------------------------------------------------------------------
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
        raise exception
            'Erreur récupération suivi : %',
            sqlerrm;
end;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking(text, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_order_tracking(text, uuid) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 4. Traçabilité des paiements (protection idempotente, déjà couverte par
--    20260911100000 — rejoue sans risque pour les bases fraîches).
-- ----------------------------------------------------------------------------
ALTER TABLE "public"."payments"
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS "provider_transaction_id" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "webhook_received_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "failure_reason" TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
  ON public.payments(provider_transaction_id);