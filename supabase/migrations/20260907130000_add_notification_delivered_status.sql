-- ============================================================================
-- 20260907130000_add_notification_delivered_status.sql
--
-- Meta WhatsApp Cloud API retourne des accusés de réception (`statuses`)
-- avec le statut `delivered`. La colonne notifications.status (enum
-- notification_status) n'acceptait que pending/sent/failed, donc la mise à
-- jour échouait silencieusement côté webhook.
--
-- Ajout de la valeur `delivered` à l'enum (ADD VALUE IF NOT EXISTS,
-- non destructif). Ne pas l'utiliser dans la même transaction.
-- ============================================================================

DO $$
BEGIN
  ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'delivered';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;