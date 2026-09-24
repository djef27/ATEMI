-- Security hardening: révoquer les droits EXECUTE trop permissifs
-- et restaurer uniquement service_role pour les fonctions sensibles.
-- Ces corrections ont été appliquées manuellement sur le remote.

-- ============================================================================
-- REVOKE: retirer EXECUTE à PUBLIC, anon et authenticated
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.confirm_deposit_payment(uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prepare_order_notifications(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prepare_vendor_order_notification(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prepare_admin_order_notification(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_delivery_when_ready()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.trigger_order_notifications()
FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- GRANT: restaurer les droits service_role uniquement
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.confirm_deposit_payment(uuid, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.prepare_order_notifications(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.prepare_vendor_order_notification(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.prepare_admin_order_notification(uuid)
TO service_role;
