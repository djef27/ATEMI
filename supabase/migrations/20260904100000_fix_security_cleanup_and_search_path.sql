-- ============================================================================
-- FIX SECURITY: cleanup_expired_trash_products() lacks EXECUTE restrictions
-- This SECURITY DEFINER function can permanently delete products.
-- Must be restricted to service_role only.
-- ============================================================================

-- Revoke from all roles that shouldn't have access
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_trash_products()
FROM PUBLIC, anon, authenticated;

-- Grant only to service_role (used by cron jobs)
GRANT EXECUTE ON FUNCTION public.cleanup_expired_trash_products()
TO service_role;

-- Also fix: is_product_visible() missing SET search_path
-- (parameter names kept identical to the original function: CREATE OR REPLACE
-- cannot rename parameters of an existing function without dropping it first)
CREATE OR REPLACE FUNCTION public.is_product_visible(
  p_status text,
  p_deleted_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p_status = 'active'
    AND p_deleted_at IS NULL;
$function$;