-- ============================================================================
-- FIX: Add missing RLS policies
-- 1. Vendor read access on orders (vendor/commandes page is broken without it)
-- 2. Authenticated INSERT on profiles (registration upsert requires it)
-- ============================================================================

-- 1. Allow vendors to read orders containing their products
DROP POLICY IF EXISTS "orders_vendor_read" ON "public"."orders";
CREATE POLICY "orders_vendor_read"
  ON "public"."orders"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."order_items" oi
      WHERE oi.order_id = orders.id
        AND oi.vendor_id = "public"."get_my_vendor_id"()
    )
  );

-- 2. Allow authenticated users to insert their own profile (registration)
DROP POLICY IF EXISTS "profiles_insert_own" ON "public"."profiles";
CREATE POLICY "profiles_insert_own"
  ON "public"."profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (("id" = "auth"."uid"()));