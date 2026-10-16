-- Vendor order reads depend on helpers that are intentionally unavailable to
-- anon. Keep the existing predicate and make its intended role explicit.
DROP POLICY IF EXISTS "orders_vendor_read" ON public.orders;

CREATE POLICY "orders_vendor_read"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    vendor_id = public.get_my_vendor_id()
    OR public.order_has_vendor_items(id, public.get_my_vendor_id())
  );
