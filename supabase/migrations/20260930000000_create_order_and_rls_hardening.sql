-- ============================================================================
-- AUDIT 2026-09-30 — Hardening `create_order` + RLS
--
-- Corrige et durcitcreate_order (version de reference), qui reste
-- idempotente (CREATE OR REPLACE) et donc sure a appliquer que la migration
-- 20260911120000 ait deja ete deployee ou non.
--
-- Defauts corriges :
--   1. delivery_balance n'incluait pas les frais de livraison
--      -> total_amount != deposit_amount + delivery_balance
--      -> violated orders_total_split_check => checkout livre en erreur 500.
--   2. Zone de livraison desactivee (is_active = false) encore acceptee.
--   3. product_id duplique dans p_items : le controle de stock lisait deux fois
--      la meme quantite (boucle 1) et decrementeait plus tard (boucle 2)
--      -> stock negatif et totaux gonfles.
--   4. Produits en corbeille (deleted_at) encore commandables.
--   5. `FOR UPDATE` dans l'ordre fourni par le client -> interblocage entre
--      deux paniers [A,B] et [B,A].
--   6. orders.vendor_id jamais renseigne -> la liste des commandes vendeur
--      (RLS orders_vendor_read sur vendor_id) etait structurellement vide.
--
-- RLS :
--   7. Suppression des policies INSERT ... WITH CHECK (true) sur les tables
--      financieres : elles autorisaient un client authentifie a forger une
--      ligne `payments` en statut 'paid' sur la commande d'autrui. Les
--      insertions applicatives passent toutes par des fonctions SECURITY
--      DEFINER (create_order) ou par la cle service_role (bypass RLS), donc
--      ces policies n apportaient rien.
--   8. orders_vendor_read : lecture par le vendeur via order_items, sans
--      recursion RLS (helper SECURITY DEFINER).
--
-- Toutes les operations sont IF EXISTS / IF NOT EXISTS : rejouable sans risque.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Garde-fou : verifier que le socle existe (migration appliquee sur la bonne
--    base). Ne leve pas d'erreur pour permettre un rejeu partiel sans risque.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.orders') IS NULL THEN
        RAISE WARNING 'create_order hardening ignoree : table public.orders absente';
        RETURN;
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 1. orders.vendor_id : colonne (si absente) + backfill des commandes existantes
--    mono-vendeur.
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'vendor_id'
    ) THEN
        UPDATE public.orders o
        SET vendor_id = sub.vendor_id
        FROM (
            SELECT oi.order_id, MIN(oi.vendor_id::text)::uuid AS vendor_id
            FROM public.order_items oi
            GROUP BY oi.order_id
            HAVING COUNT(DISTINCT oi.vendor_id) = 1
        ) sub
        WHERE o.id = sub.order_id
          AND o.vendor_id IS DISTINCT FROM sub.vendor_id;
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. Helper SECURITY DEFINER : la commande contient-elle des articles du vendeur ?
--    SECURITY DEFINER + search_path fige => la lecture de order_items est faite
--    avec les droits du proprietaire, donc RLS n'est pas evalue et la politique
--    sur `orders` ne peut pas recurser (cf. 20260909160000).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.order_has_vendor_items(
    p_order_id  uuid,
    p_vendor_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $fn$
    SELECT EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.vendor_id = p_vendor_id
    );
$fn$;

REVOKE ALL ON FUNCTION public.order_has_vendor_items(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_has_vendor_items(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "orders_vendor_read" ON public.orders;
CREATE POLICY "orders_vendor_read"
  ON public.orders
  FOR SELECT
  USING (
    vendor_id = public.get_my_vendor_id()
    OR public.order_has_vendor_items(id, public.get_my_vendor_id())
  );

-- ----------------------------------------------------------------------------
-- 3. Purge des policies INSERT permissives sur les tables financieres
--    (RLS ne distingue pas un INSERT fait dans une fonction SECURITY DEFINER
--    d'un INSERT direct via PostgREST : le WITH CHECK (true) laissait donc
--    forger des paiements 'paid' par n'importe quel client authentifie).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_insert_via_rpc" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert_via_rpc" ON public.order_items;
DROP POLICY IF EXISTS "payments_insert_via_rpc" ON public.payments;
DROP POLICY IF EXISTS "notifications_insert_via_rpc" ON public.notifications;

-- Defence en profondeur : plus aucune policy INSERT non-admin sur ces tables.
DROP POLICY IF EXISTS "orders_customer_insert" ON public.orders;

-- ----------------------------------------------------------------------------
-- 4. Produits en corbeille invisibles en lecture publique
--    (la fonction is_product_visible() existe depuis 20260831100000 mais n'etait
--    referencee par aucune policy).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'deleted_at'
    ) THEN
        DROP POLICY IF EXISTS "products_public_read" ON public.products;
        CREATE POLICY "products_public_read" ON public.products
          FOR SELECT USING (
            status = 'active'
            AND (deleted_at IS NULL)
          );
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 5. cleanup_expired_trash_products : SECURITY DEFINER sans search_path fige
--    (le fichier 20260904100000 corrigeait le grant mais oubliait search_path).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'cleanup_expired_trash_products'
          AND p.prosecdef
    ) THEN
        EXECUTE 'ALTER FUNCTION public.cleanup_expired_trash_products() SET search_path = ''public''';
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 6. create_order — version de reference durcie
-- ----------------------------------------------------------------------------
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

    v_product record;

    v_line_total numeric;
    v_item_deposit numeric;

    -- Regroupement des lignes de panier par produit (anti-doublon + verrous
    -- dans un ordre global et stable).
    v_lines record;
    v_locked_product_id uuid;

    -- Comptages de controle (produits demandes vs produits reellement trouves).
    v_requested_products integer := 0;
    v_found_products integer := 0;

    v_customer_id uuid;

    -- Vendeur unique du panier (null si le panier melange plusieurs vendeurs).
    v_vendor_id uuid;
    v_vendor_count integer := 0;

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

    -- auth.uid() prime toujours sur p_customer_id : impossible de rattacher une
    -- commande a un autre compte, meme pour un appel anon.
    if auth.uid() is not null then
        v_customer_id := auth.uid();
    else
        v_customer_id := p_customer_id;
    end if;

    if p_items is null
       or jsonb_array_length(p_items) = 0 then
        raise exception 'Le panier est vide';
    end if;

    -- Identifiants de produit exploitables (le cast uuid lèverait une erreur
    -- opaque pour une valeur non conforme).
    if exists (
        select 1
        from jsonb_array_elements(p_items) l
        where l.value ->> 'product_id' is null
           or (l.value ->> 'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
        raise exception 'Identifiant de produit invalide';
    end if;

    -- ---------------------------------------------------------------------
    -- VERROUILLAGE en une passe, dans un ordre total et stable (p.id).
    -- Deux paniers contenant les memes produits ([A,B] et [B,A]) acquierent
    -- donc les memes verrous dans le meme ordre -> plus d'interblocage (40P01).
    -- Impossible de combiner FOR UPDATE et GROUP BY dans la meme requete, d'ou
    -- les deux passes.
    -- ---------------------------------------------------------------------
    for v_locked_product_id in
        select p.id
        from public.products p
        where p.id in (
            select distinct (value ->> 'product_id')::uuid
            from jsonb_array_elements(p_items)
        )
        order by p.id
        for update
    loop
        null;
    end loop;

    -- Tous les produits du panier doivent exister : sinon une ligne du panier
    -- disparaitrait silencieusement des totaux.
    select count(distinct (value ->> 'product_id')::uuid)
    into v_requested_products
    from jsonb_array_elements(p_items);

    select count(*)
    into v_found_products
    from public.products p
    where p.id in (
        select distinct (value ->> 'product_id')::uuid
        from jsonb_array_elements(p_items)
    );

    if v_found_products < v_requested_products then
        raise exception 'Produit introuvable dans le panier';
    end if;

    -- ---------------------------------------------------------------------
    -- Controle + calcul des totaux. Les verrous sont deja detenus par la passe
    -- ci-dessus, et les quantites sont cumulees par produit : un produit
    -- present deux fois dans p_items ne peut plus passer deux fois le controle
    -- de stock (avant : stock negatif possible + totaux gonfles).
    -- ---------------------------------------------------------------------
    for v_lines in
        select
            p.id,
            p.vendor_id,
            p.name,
            p.selling_price,
            p.stock,
            p.status,
            p.deposit_rate,
            (p.deleted_at is not null) as is_trashed,
            sum(l.quantity)::integer as quantity

        from (
            select
                (value ->> 'product_id')::uuid as product_id,
                coalesce((value ->> 'quantity')::integer, 0) as quantity
            from jsonb_array_elements(p_items)
        ) l

        join public.products p on p.id = l.product_id

        group by
            p.id,
            p.vendor_id,
            p.name,
            p.selling_price,
            p.stock,
            p.status,
            p.deposit_rate,
            p.deleted_at
    loop

        if v_lines.quantity <= 0 then
            raise exception 'Quantite invalide';
        end if;

        if v_lines.status <> 'active' or v_lines.is_trashed then
            raise exception
                'Le produit "%" n''est plus disponible',
                v_lines.name;
        end if;

        if v_lines.stock < v_lines.quantity then
            raise exception
                'Stock insuffisant pour "%"',
                v_lines.name;
        end if;

        v_line_total :=
            v_lines.selling_price * v_lines.quantity;

        v_item_deposit :=
            round(v_lines.selling_price * v_lines.deposit_rate / 100, 2) * v_lines.quantity;

        v_subtotal :=
            v_subtotal + v_line_total;

        v_deposit :=
            v_deposit + v_item_deposit;

        v_vendor_count := v_vendor_count + 1;
        v_vendor_id := v_lines.vendor_id;

    end loop;

    if v_vendor_count = 0 then
        raise exception 'Aucun produit valide dans le panier';
    end if;

    -- vendors mono-vendeur : alimente orders.vendor_id (liste vendeur + RLS).
    -- Panier multi-vendeurs : NULL, la lecture vendeur se fait via order_items.
    if v_vendor_count > 1 then
        v_vendor_id := null;
    end if;

    if p_delivery_required then

        select delivery_fee
        into v_delivery_fee

        from public.delivery_zones

        where id = p_delivery_zone_id
          and is_available = true
          -- is_active est le kill-switch admin : sans ce filtre une zone
          -- desactivee continuait d'etre acceptee au checkout (RLS est contourne
          -- ici car la fonction est SECURITY DEFINER).
          and is_active = true;

        if not found then
            raise exception
                'Zone de livraison indisponible';
        end if;

    else

        v_delivery_fee := 0;

    end if;

    v_total :=
        v_subtotal + v_delivery_fee;

    -- FIX: delivery_balance inclut les frais de livraison, sinon
    -- total_amount != deposit_amount + delivery_balance et la contrainte
    -- orders_total_split_check rejette la commande.
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
        vendor_id,
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
        v_vendor_id,
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

    for v_lines in
        select
            p.id,
            p.vendor_id,
            p.name,
            p.selling_price,
            p.deposit_rate,
            sum(l.quantity)::integer as quantity

        from (
            select
                (value ->> 'product_id')::uuid as product_id,
                coalesce((value ->> 'quantity')::integer, 0) as quantity
            from jsonb_array_elements(p_items)
        ) l

        join public.products p on p.id = l.product_id

        group by p.id, p.vendor_id, p.name, p.selling_price, p.deposit_rate

        order by p.id
    loop
        v_line_total :=
            v_lines.selling_price * v_lines.quantity;

        v_item_deposit :=
            round(v_lines.selling_price * v_lines.deposit_rate / 100, 2) * v_lines.quantity;

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
            v_lines.id,
            v_lines.vendor_id,

            v_lines.name,
            v_lines.quantity,

            v_lines.selling_price,
            v_line_total,

            v_lines.deposit_rate,
            v_item_deposit,
            v_line_total - v_item_deposit

        );

        update public.products

        set
            stock = stock - v_lines.quantity,
            updated_at = now()

        where id = v_lines.id;

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
        p_provider

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
