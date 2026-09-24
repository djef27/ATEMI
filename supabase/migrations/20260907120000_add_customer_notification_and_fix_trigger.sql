-- ============================================================================
-- 20260907120000_add_customer_notification_and_fix_trigger.sql
--
-- OBJECTIFS
--   1. Antidouleur : supprimer le trigger trg_order_notifications_after_confirmation
--      qui insérait des notifications via prepare_* pendant le passage à
--      'confirmed', PENDANT que confirm_deposit_payment (canonique) insère déjà
--      directement vendeur + admin. Double insertion → viol. UNIQUE
--      (idx_notifications_order_admin_type_unique /
--       idx_notifications_order_vendor_type_unique) → confirmation de paiement
--      en échec silencieux. Le trigger est redondant depuis
--      20260828230000_fix_concurrency.sql.
--
--   2. Notification CLIENT : préparer + insérer une notification
--      'new_order_customer' (WhatsApp) pour chaque acompte confirmé, en
--      conservant les 3 automatisations distinctes :
--        - reçu (côté API dispatch / page recu)
--        - message vendeur      (new_order_vendor)
--        - message admin        (new_order_admin)
--      + nouvelle : message client (new_order_customer)
--
--   3. Index UNIQUE partiel pour garantir l'idempotence de la notification
--      client (pas de doublon si confirm_deposit_payment est rejoué).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SUPPRIMER LE TRIGGER OBSOLÈTE (anti-doublon)
--    Les insertions de notifications sont désormais gérées ATOMIQUEMENT dans
--    confirm_deposit_payment (même transaction que le paiement + commande).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS "trg_order_notifications_after_confirmation" ON public.orders;

-- La fonction trigger devient inutile : on la rend non invocable par les
-- rôles applicatifs (la garder pour compatibilité d'historique).
REVOKE ALL ON FUNCTION public.trigger_order_notifications() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. IDEMPOTENCE NOTIFICATION CLIENT
--    Empêche deux notifications new_order_customer pour la même commande.
--    (Le vendeur/admin ont déjà leurs indexes UNIQUE partiels.)
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS "idx_notifications_order_customer_type_unique";
CREATE UNIQUE INDEX "idx_notifications_order_customer_type_unique"
  ON public.notifications ("order_id", "notification_type")
  WHERE ("recipient_profile_id" IS NULL)
    AND ("recipient_vendor_id" IS NULL)
    AND ("recipient_driver_id" IS NULL)
    AND ("recipient_phone" IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 3. NOUVELLE VERSION DE confirm_deposit_payment AVEC NOTIFICATION CLIENT
--    Gauche : mêmes garanties financières que la version canonique
--    (verrous FOR UPDATE, idempotence payment.status='paid', atomique).
--    Ajouter : notification client 'new_order_customer' en plus du vendeur
--    et de l'admin.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.confirm_deposit_payment(uuid, text, text);

CREATE OR REPLACE FUNCTION "public"."confirm_deposit_payment"(
    "p_payment_id" "uuid",
    "p_transaction_reference" "text" DEFAULT NULL::"text",
    "p_payment_method" "text" DEFAULT NULL::"text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
AS $$
declare
    v_payment record;
    v_order record;
    v_vendor record;
    v_admin record;
    v_item record;
    v_old_status order_status;
    v_final_transaction_ref text;
    v_vendor_message text;
    v_admin_message text;
    v_customer_message text;
    v_existing_customer_notification uuid;
begin
    -- ========================================================
    -- 1. VALIDATIONS
    -- ========================================================
    if p_payment_id is null then
        raise exception 'payment_id obligatoire';
    end if;

    -- Générer une référence de transaction si absente (confirmation admin manuelle)
    if p_transaction_reference is null or trim(p_transaction_reference) = '' then
        if p_payment_method = 'admin_manual' then
            v_final_transaction_ref := 'MANUAL-' || gen_random_uuid()::text;
        else
            raise exception 'Référence de transaction obligatoire';
        end if;
    else
        v_final_transaction_ref := trim(p_transaction_reference);
    end if;

    -- ========================================================
    -- 2. RÉCUPÉRATION DU PAIEMENT WITH ROW LOCK
    -- ========================================================
    select
        p.id,
        p.order_id,
        p.payment_type,
        p.amount,
        p.currency,
        p.status,
        p.transaction_reference
    into v_payment
    from public.payments p
    where p.id = p_payment_id
    for update;

    if not found then
        raise exception 'Paiement introuvable';
    end if;

    -- ========================================================
    -- 3. VÉRIFICATION TYPE DE PAIEMENT
    -- ========================================================
    if v_payment.payment_type <> 'deposit' then
        raise exception 'Ce paiement n''est pas un acompte';
    end if;

    -- ========================================================
    -- 4. IDEMPOTENCE (DB-level)
    --    Si déjà payé, on ne fait RIEN (ni commande, ni notifications).
    -- ========================================================
    if v_payment.status = 'paid' then
        return jsonb_build_object(
            'success', true,
            'already_processed', true,
            'payment_id', v_payment.id,
            'order_id', v_payment.order_id,
            'message', 'Paiement déjà confirmé'
        );
    end if;

    -- ========================================================
    -- 5. RÉCUPÉRATION COMMANDE WITH ROW LOCK
    -- ========================================================
    select
        o.id,
        o.order_number,
        o.status,
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
        o.delivery_balance
    into v_order
    from public.orders o
    where o.id = v_payment.order_id
    for update;

    if not found then
        raise exception 'Commande introuvable';
    end if;

    v_old_status := v_order.status;

    -- ========================================================
    -- 6. VERIFY ORDER IS IN CORRECT STATE
    -- ========================================================
    if v_order.status <> 'pending_payment' then
        raise exception 'Commande dans un état invalide pour confirmation: %', v_order.status;
    end if;

    -- ========================================================
    -- 7. CONFIRMATION DU PAIEMENT
    -- ========================================================
    update public.payments
    set
        status = 'paid',
        transaction_reference = v_final_transaction_ref,
        payment_method = nullif(trim(p_payment_method), ''),
        paid_at = now(),
        updated_at = now()
    where id = v_payment.id;

    -- ========================================================
    -- 8. CONFIRMATION COMMANDE
    --    (Plus AUCUN trigger sur ce passage : celui-ci a été supprimé.)
    -- ========================================================
    update public.orders
    set
        status = 'confirmed',
        updated_at = now()
    where id = v_order.id;

    -- ========================================================
    -- 9. HISTORIQUE
    -- ========================================================
    insert into public.order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by,
        note
    )
    values (
        v_order.id,
        v_old_status,
        'confirmed',
        null,
        'Acompte confirmé par le système de paiement.'
    );

    -- ========================================================
    -- 10. NOTIFICATIONS VENDEURS (insertion idempotente)
    -- ========================================================
    for v_vendor in
        select distinct
            v.id,
            v.name,
            v.whatsapp_number,
            v.phone
        from public.order_items oi
        inner join public.vendors v on v.id = oi.vendor_id
        where oi.order_id = v_order.id
    loop
        v_vendor_message :=
            '🛍️ NOUVELLE COMMANDE' || E'\n\n' ||
            'Commande : ' || v_order.order_number || E'\n\n' ||
            'Client : ' || v_order.customer_name || E'\n' ||
            'Téléphone : ' || v_order.customer_phone || E'\n' ||
            case
                when v_order.customer_whatsapp is not null
                then 'WhatsApp : ' || v_order.customer_whatsapp || E'\n'
                else ''
            end ||
            E'\n📦 VOS PRODUITS\n';

        for v_item in
            select oi.product_name, oi.quantity, oi.unit_price, oi.line_total
            from public.order_items oi
            where oi.order_id = v_order.id and oi.vendor_id = v_vendor.id
            order by oi.created_at
        loop
            v_vendor_message := v_vendor_message ||
                '• ' || v_item.product_name || ' × ' || v_item.quantity ||
                ' — ' || to_char(v_item.line_total, 'FM999G999G999') || ' FCFA' || E'\n';
        end loop;

        v_vendor_message := v_vendor_message ||
            E'\n📍 LIVRAISON\n' ||
            'Ville : ' || coalesce(v_order.delivery_city, 'Retrait') || E'\n' ||
            case
                when v_order.delivery_required
                then 'Adresse : ' || coalesce(v_order.delivery_address, 'Non renseignée') || E'\n'
                else 'Mode : Retrait client' || E'\n'
            end ||
            E'\n💰 RESTE À PAYER À LA LIVRAISON : ' ||
            to_char(v_order.delivery_balance, 'FM999G999G999') || ' FCFA' ||
            E'\n\nStatut : COMMANDE CONFIRMÉE';

        insert into public.notifications (
            order_id, recipient_vendor_id, channel, notification_type,
            recipient_phone, message, status
        )
        select
            v_order.id, v_vendor.id, 'whatsapp', 'new_order_vendor',
            coalesce(v_vendor.whatsapp_number, v_vendor.phone),
            v_vendor_message, 'pending'
        where not exists (
            select 1 from public.notifications n
            where n.order_id = v_order.id
              and n.recipient_vendor_id = v_vendor.id
              and n.notification_type = 'new_order_vendor'
        );
    end loop;

    -- ========================================================
    -- 11. NOTIFICATIONS ADMIN (insertion idempotente)
    -- ========================================================
    v_admin_message :=
        '🔔 NOUVELLE COMMANDE CONFIRMÉE' || E'\n\n' ||
        'Commande : ' || v_order.order_number || E'\n\n' ||
        '👤 CLIENT' || E'\n' ||
        'Nom : ' || v_order.customer_name || E'\n' ||
        'Téléphone : ' || v_order.customer_phone || E'\n' ||
        case
            when v_order.customer_whatsapp is not null
            then 'WhatsApp : ' || v_order.customer_whatsapp || E'\n'
            else ''
        end ||
        E'\n📦 PRODUITS\n';

    for v_item in
        select oi.product_name, oi.quantity, oi.unit_price, oi.line_total, v.name as vendor_name
        from public.order_items oi
        left join public.vendors v on v.id = oi.vendor_id
        where oi.order_id = v_order.id
        order by oi.created_at
    loop
        v_admin_message := v_admin_message ||
            '• ' || v_item.product_name || ' × ' || v_item.quantity ||
            ' — ' || to_char(v_item.line_total, 'FM999G999G999') || ' FCFA' ||
            ' — Vendeur : ' || coalesce(v_item.vendor_name, 'Non défini') || E'\n';
    end loop;

    v_admin_message := v_admin_message ||
        E'\n💰 RÉCAPITULATIF FINANCIER\n' ||
        'Sous-total : ' || to_char(v_order.subtotal, 'FM999G999G999') || ' FCFA' || E'\n' ||
        'Livraison : ' || to_char(v_order.delivery_fee, 'FM999G999G999') || ' FCFA' || E'\n' ||
        'Total : ' || to_char(v_order.total_amount, 'FM999G999G999') || ' FCFA' || E'\n' ||
        'Acompte payé : ' || to_char(v_order.deposit_amount, 'FM999G999G999') || ' FCFA' || E'\n' ||
        'Solde produit : ' || to_char(v_order.delivery_balance, 'FM999G999G999') || ' FCFA' || E'\n\n' ||
        '📍 LIVRAISON\n' ||
        'Ville : ' || coalesce(v_order.delivery_city, 'Retrait') || E'\n' ||
        case
            when v_order.delivery_required
            then 'Adresse : ' || coalesce(v_order.delivery_address, 'Non renseignée')
            else 'Mode : Retrait client'
        end;

    for v_admin in
        select p.id, p.phone, p.whatsapp_number
        from public.profiles p
        where p.role = 'admin' and p.is_active = true
    loop
        insert into public.notifications (
            order_id, recipient_profile_id, channel, notification_type,
            recipient_phone, message, status
        )
        select
            v_order.id, v_admin.id, 'whatsapp', 'new_order_admin',
            coalesce(v_admin.whatsapp_number, v_admin.phone),
            v_admin_message, 'pending'
        where not exists (
            select 1 from public.notifications n
            where n.order_id = v_order.id
              and n.recipient_profile_id = v_admin.id
              and n.notification_type = 'new_order_admin'
        );
    end loop;

    -- ========================================================
    -- 12. NOTIFICATION CLIENT 'new_order_customer' (idempotente)
    --      Destinataire : customer_whatsapp (sinon customer_phone).
    -- ========================================================
    v_customer_message :=
        '✅ COMPTE CONFIRMÉ' || E'\n\n' ||
        'Bonjour ' || v_order.customer_name || ' 👋' || E'\n' ||
        'Votre commande ' || v_order.order_number || ' est bien confirmée.' || E'\n\n' ||
        '📦 DÉTAIL' || E'\n' ||
        'Total : ' || to_char(v_order.total_amount, 'FM999G999G999') || ' FCFA' || E'\n' ||
        'Acompte payé : ' || to_char(v_order.deposit_amount, 'FM999G999G999') || ' FCFA' || E'\n' ||
        'Reste à payer à la livraison : ' || to_char(v_order.delivery_balance, 'FM999G999G999') || ' FCFA' || E'\n\n' ||
        '📍 ' || case
            when v_order.delivery_required then 'Livraison à ' || coalesce(v_order.delivery_city, '')
            else 'Retrait client'
        end || E'\n\n' ||
        'Merci pour votre confiance ❤️';

    select n.id
    into v_existing_customer_notification
    from public.notifications n
    where n.order_id = v_order.id
      and n.notification_type = 'new_order_customer'
    limit 1;

    if v_existing_customer_notification is null
       and coalesce(v_order.customer_whatsapp, v_order.customer_phone) is not null
    then
        insert into public.notifications (
            order_id, channel, notification_type,
            recipient_phone, message, status
        )
        values (
            v_order.id, 'whatsapp', 'new_order_customer',
            coalesce(v_order.customer_whatsapp, v_order.customer_phone),
            v_customer_message, 'pending'
        );
    end if;

    -- ========================================================
    -- 13. RETOUR
    -- ========================================================
    return jsonb_build_object(
        'success', true,
        'already_processed', false,
        'payment_id', v_payment.id,
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'payment_status', 'paid',
        'order_status', 'confirmed',
        'deposit_amount', v_order.deposit_amount,
        'delivery_balance', v_order.delivery_balance,
        'delivery_fee', v_order.delivery_fee,
        'notifications_created', true,
        'message', 'Paiement confirmé, commande confirmée et notifications préparées (vendeur, admin, client)'
    );

exception
    when others then
        raise exception 'Erreur confirmation paiement : %', sqlerrm;
end;
$$;

ALTER FUNCTION "public"."confirm_deposit_payment"(uuid, text, text) OWNER TO "postgres";

REVOKE EXECUTE ON FUNCTION public.confirm_deposit_payment(uuid, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_deposit_payment(uuid, text, text)
TO service_role;