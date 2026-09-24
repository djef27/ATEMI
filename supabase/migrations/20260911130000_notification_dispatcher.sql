-- ============================================================================
-- 20260911130000_notification_dispatcher.sql
--
-- Fiabilise la file de notifications WhatsApp :
--   1. Statut 'sending' : indique qu'une notification a été RÉSERVÉE de façon
--      atomique par un worker (empêche deux workers d'envoyer deux fois la
--      même notification).
--   2. Colonnes attempts / next_retry_at : mécanisme de retry après erreur
--      temporaire (backoff). Une erreur définitive bascule en 'failed'.
--   3. claim_pending_whatsapp_notifications : un SEUL point d'entrée atomique
--      (UPDATE ... FOR UPDATE SKIP LOCKED) utilisé par le dispatcher central.
--      Reclame aussi les notifications 'sending' fantômes (worker mort) après
--      2 minutes.
--
-- Idempotent et non destructif. Ne modifie aucune migration existante.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUM notification_status : valeurs non destructives
--    'delivered' re-asserté (si une base fraîche ne l'a pas encore).
--    'sending'   ajouté pour le claim atomique.
--    (Ne pas utiliser ces valeurs dans la même transaction.)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'delivered';
  ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'sending';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. COLONNES DE RETRY sur notifications
-- ----------------------------------------------------------------------------
ALTER TABLE "public"."notifications"
  ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_retry_at" timestamptz;

-- NB: l'index partiel idx_notifications_dispatch (qui référence la valeur enum
-- 'sending') est créé dans la migration 20260911140000_notification_dispatch_index.sql.
-- Postgres interdit d'utiliser une nouvelle valeur enum dans un index DANS LA MÊME
-- transaction que l'ALTER TYPE ... ADD VALUE (SQLSTATE 55P04).

-- ----------------------------------------------------------------------------
-- 3. CLAIM ATOMIQUE (single mechanism)
--    Réservé au serveur (service_role). Les rôles applicatifs n'y ont pas
--    accès.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_pending_whatsapp_notifications(
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
declare
    v_limit integer;
    v_rows jsonb;
begin

    v_limit := coalesce(p_limit, 10);
    if v_limit < 1 then
        v_limit := 10;
    end if;

    update public.notifications n
    set
        status = 'sending',
        updated_at = now()
    where n.id in (
        select sub.id
        from public.notifications sub
        where sub.channel = 'whatsapp'
          and (
                (sub.status = 'pending'
                 and (sub.next_retry_at is null or sub.next_retry_at <= now()))
                or
                (sub.status = 'sending' and sub.updated_at < now() - interval '2 minutes')
              )
        order by sub.created_at asc
        limit v_limit
        for update skip locked
    )
    returning jsonb_agg(
        jsonb_build_object(
            'id', n.id,
            'recipient_phone', n.recipient_phone,
            'message', n.message,
            'attempts', n.attempts
        )
    ) into v_rows;

    return coalesce(v_rows, '[]'::jsonb);

end;
$fn$;

REVOKE ALL ON FUNCTION public.claim_pending_whatsapp_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_whatsapp_notifications(integer) TO service_role;