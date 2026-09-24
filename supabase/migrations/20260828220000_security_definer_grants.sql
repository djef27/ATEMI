-- ============================================================================
-- SECURITY DEFINER Functions - Grant Audit and Hardening
-- Ensure all sensitive financial functions are only executable by service_role
-- ============================================================================

-- Functions that MUST be service_role only (already done in 20260827190000_security_hardening.sql):
-- - confirm_deposit_payment(uuid, text, text)
-- - prepare_order_notifications(uuid)
-- - prepare_vendor_order_notification(uuid, uuid)
-- - prepare_admin_order_notification(uuid)
-- - create_delivery_when_ready()
-- - trigger_order_notifications()

-- Additional functions that should be service_role only:

-- get_admin_order_summary - admin only (already has internal check, but restrict execute)
REVOKE EXECUTE ON FUNCTION public.get_admin_order_summary(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_order_summary(uuid)
TO service_role;

-- get_order_receipt - can be called by customers with order_number + tracking_token
-- Keep accessible to anon/authenticated for customer-facing receipt page
-- But ensure it doesn't leak sensitive data (it only returns order details, no payment secrets)

-- get_order_tracking - similar to receipt, keep accessible

-- get_my_role, is_admin, is_vendor, is_driver, get_my_vendor_id, get_my_driver_id
-- These are utility functions for RLS policies, keep accessible

-- create_order - called by customers during checkout via anon key
-- Must be accessible to anon/authenticated
-- SECURITY DEFINER runs as postgres, bypasses RLS for mutations
-- Input validation happens inside the function

-- NOT SENSITIVE / READ-ONLY - keep accessible:
-- - get_order_receipt(text, uuid)
-- - get_order_tracking(text, uuid)
-- - get_my_role()
-- - is_admin()
-- - is_vendor()
-- - is_driver()
-- - get_my_vendor_id()
-- - get_my_driver_id()

-- The create_delivery_when_ready() trigger function is already restricted

-- Verify create_order has proper grants (should be accessible to anon for checkout)
-- This is already the default in Supabase

-- Explicitly revoke create_order from PUBLIC (but keep for anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.create_order(uuid, text, text, text, text, text, uuid, boolean, text, jsonb)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, text, text, text, text, text, uuid, boolean, text, jsonb)
TO anon, authenticated, service_role;