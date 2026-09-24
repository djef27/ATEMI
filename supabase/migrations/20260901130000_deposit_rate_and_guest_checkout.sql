-- ============================================================================
-- FIX: create_order avec deposit_rate par produit + checkout invite
-- Restaure la logique d'origine (schema reel : status, delivery_balance,
-- customer_name) et ajoute uniquement ce qui est necessaire : le taux
-- d'acompte par produit (products.deposit_rate, deja ajoute) et le champ
-- customer_email pour les invites. Aucune colonne inexistante referencee.
-- ============================================================================

-- 1. Ajouter customer_email a orders (nullable, checkout invite)
ALTER TABLE "public"."orders"
  ADD COLUMN IF NOT EXISTS "customer_email" TEXT NULL;

-- 2. create_order : meme signature que la version restauree
--    (uuid,text,text,text,text,text,uuid,boolean,text,jsonb), compatible
--    CREATE OR REPLACE. p_customer_email ajoute en dernier parametre optionnel.
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
  p_customer_email    text    DEFAULT NULL::text
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

begin

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

    v_delivery_balance :=
        v_subtotal - v_deposit;

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
        payment_method

    )

    values (

        v_order_id,
        'deposit',
        v_deposit,
        'XOF',
        'pending',
        null

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

-- 3. Lookup invite par email + numero de commande (schema reel confirme)
CREATE OR REPLACE FUNCTION public.get_order_by_email(
  p_order_number TEXT,
  p_email        TEXT
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'found', true,
    'order_number', o.order_number,
    'tracking_token', o.tracking_token,
    'status', o.status,
    'total_amount', o.total_amount,
    'deposit_amount', o.deposit_amount,
    'delivery_balance', o.delivery_balance,
    'currency', 'XOF',
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'delivery_city', o.delivery_city,
    'created_at', o.created_at
  )
  FROM public.orders o
  WHERE o.order_number = p_order_number
    AND o.customer_email = lower(trim(p_email))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_email(TEXT, TEXT) TO anon, authenticated;
DROP FUNCTION IF EXISTS public.create_order(uuid,text,text,text,text,text,uuid,boolean,text,jsonb);
