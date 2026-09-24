-- ============================================================================
-- AJOUT deposit_rate PAR PRODUIT + SNAPSHOTS DANS ORDER_ITEMS
-- ============================================================================

-- 1. Ajouter deposit_rate aux products (pourcentage, défaut 50%)
ALTER TABLE "public"."products"
  ADD COLUMN "deposit_rate" NUMERIC(5,2) NOT NULL DEFAULT 50
  CHECK ("deposit_rate" >= 0 AND "deposit_rate" <= 100);

-- 2. Recalculer deposit_amount et remaining_amount existants avec le nouveau taux
UPDATE "public"."products"
SET
  "deposit_amount" = ROUND("selling_price" * 50 / 100, 2),
  "remaining_amount" = "selling_price" - ROUND("selling_price" * 50 / 100, 2)
WHERE "deposit_amount" != ROUND("selling_price" * 50 / 100, 2);

-- 3. Ajouter les colonnes de snapshot à order_items
--    Remote columns: product_name, unit_price, line_total (no _snapshot suffix)
ALTER TABLE "public"."order_items"
  ADD COLUMN "deposit_rate_snapshot" NUMERIC(5,2),
  ADD COLUMN "deposit_amount_snapshot" NUMERIC(12,2),
  ADD COLUMN "remaining_amount_snapshot" NUMERIC(12,2);

-- 4. Mettre à jour les order_items existants avec les snapshots
UPDATE "public"."order_items" oi
SET
  "deposit_rate_snapshot" = p."deposit_rate",
  "deposit_amount_snapshot" = ROUND(oi."unit_price" * p."deposit_rate" / 100, 2) * oi."quantity",
  "remaining_amount_snapshot" = oi."line_total" - ROUND(oi."unit_price" * p."deposit_rate" / 100, 2) * oi."quantity"
FROM "public"."products" p
WHERE oi."product_id" = p."id"
  AND oi."deposit_rate_snapshot" IS NULL;
