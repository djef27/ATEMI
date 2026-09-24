-- ============================================================================
-- 20260911140000_notification_dispatch_index.sql
--
-- Index partiel du dispatcher de notifications WhatsApp.
-- Créé dans une MIGRATION SÉPARÉE de l'ALTER TYPE ... ADD VALUE 'sending'
-- (20260911130000) : Postgres interdit d'utiliser une nouvelle valeur enum
-- dans la même transaction que son ajout (SQLSTATE 55P04).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_dispatch
  ON public.notifications (status, channel, next_retry_at)
  WHERE status IN ('pending', 'sending');