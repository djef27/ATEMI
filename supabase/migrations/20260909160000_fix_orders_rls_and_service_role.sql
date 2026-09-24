-- ============================================================================
-- FIX: payment initiation fails because the orders RLS graph recurses
-- and the server-side payment client can require explicit table grants.
-- ============================================================================

-- The previous vendor policy queried order_items. Its customer policy queries
-- orders, so evaluating either policy could recurse back into orders.
DROP POLICY IF EXISTS "orders_vendor_read" ON public.orders;
CREATE POLICY "orders_vendor_read"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (vendor_id = public.get_my_vendor_id());

-- Keep the grants explicit for existing databases that predate the initial
-- schema grant or where it was not restored during a partial migration.
GRANT SELECT ON public.orders TO service_role;
GRANT SELECT, UPDATE ON public.payments TO service_role;
