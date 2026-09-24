-- ============================================================================
-- RLS Policy Fixes for Financial Tables
-- 1. Allow vendors to read payments for their orders
-- 2. Ensure proper DELETE policies where needed
-- ============================================================================

-- 1. Vendor read access on payments (for orders containing their products)
DROP POLICY IF EXISTS "payments_vendor_read" ON "public"."payments";
CREATE POLICY "payments_vendor_read"
  ON "public"."payments"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."order_items" oi
      JOIN "public"."orders" o ON o.id = oi.order_id
      WHERE oi.order_id = payments.order_id
        AND oi.vendor_id = "public"."get_my_vendor_id"()
    )
  );

-- 2. Vendor read access on order_status_history (for their orders)
DROP POLICY IF EXISTS "order_history_vendor_read" ON "public"."order_status_history";
CREATE POLICY "order_history_vendor_read"
  ON "public"."order_status_history"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."order_items" oi
      WHERE oi.order_id = order_status_history.order_id
        AND oi.vendor_id = "public"."get_my_vendor_id"()
    )
  );

-- 3. Ensure orders table has vendor read policy (added in previous migration, verify)
-- This was added in 20260828100000_fix_missing_rls_policies.sql
-- CREATE POLICY IF NOT EXISTS "orders_vendor_read" ...
-- 4. Add vendor read on order_items (already exists: order_items_vendor_read)
-- Note: All financial mutations (INSERT/UPDATE/DELETE on orders, payments, order_items)
-- are performed via SECURITY DEFINER functions that bypass RLS.
-- Direct client mutations are blocked by RLS (no policies granting INSERT/UPDATE/DELETE to non-admins).