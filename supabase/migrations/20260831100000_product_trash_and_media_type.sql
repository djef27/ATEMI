-- ============================================================================
-- PRODUCT TRASH (48h delayed deletion) + media_type fallback
-- ============================================================================

-- 1. Ajouter deleted_at aux products (pour corbeille 48h)
ALTER TABLE "public"."products"
  ADD COLUMN "deleted_at" TIMESTAMPTZ NULL;

-- 2. Index pour les requêtes de suppression automatique
CREATE INDEX IF NOT EXISTS "idx_products_deleted_at"
  ON "public"."products" ("deleted_at")
  WHERE "deleted_at" IS NOT NULL;

-- 3. Exclure les produits supprimés (trash) des résultats publics
--    (les produits inactifs existants sont déjà filtrés par status)
--    Les produits avec deleted_at ne doivent JAMAIS apparaître publiquement
CREATE OR REPLACE FUNCTION public.is_product_visible(p_status text, p_deleted_at timestamptz)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT (p_status = 'active') AND (p_deleted_at IS NULL);
$$;

-- 4. Fonction pour supprimer définitivement les produits expirés (>48h)
--    Cette fonction peut être appelée par un cron job ou manuellement
CREATE OR REPLACE FUNCTION public.cleanup_expired_trash_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Supprimer les médias associés aux produits expirés
  DELETE FROM "public"."product_images"
  WHERE "product_id" IN (
    SELECT "id" FROM "public"."products"
    WHERE "deleted_at" IS NOT NULL
      AND "deleted_at" <= now() - interval '48 hours'
  );

  -- Supprimer les produits expirés
  DELETE FROM "public"."products"
  WHERE "deleted_at" IS NOT NULL
    AND "deleted_at" <= now() - interval '48 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
