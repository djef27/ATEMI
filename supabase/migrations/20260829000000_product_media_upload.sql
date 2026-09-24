-- ============================================================================
-- PRODUCT MEDIA UPLOAD
-- 1. Ajouter media_type à product_images (image | video)
-- 2. Créer le bucket product-media
-- 3. Policies de storage (lecture publique, écriture restreinte)
-- ============================================================================

-- 1. Ajouter la colonne media_type avec contrainte CHECK
ALTER TABLE "public"."product_images"
  ADD COLUMN "media_type" text NOT NULL DEFAULT 'image';

ALTER TABLE "public"."product_images"
  ADD CONSTRAINT "product_images_media_type_check"
  CHECK (("media_type" = ANY (ARRAY['image'::text, 'video'::text])));

-- 2. Créer le bucket product-media (via storage.buckets)
--    file_size_limit = 50 Mo (limite vidéo max)
--    allowed_mime_types = images (JPG/PNG/WebP) + vidéo (MP4) uniquement
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800,  -- 50 * 1024 * 1024 = 50 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];

-- 3. Policies de storage
--    Les fichiers sont stockés sous product-media/{product_id}/{filename}
--    storage.foldername(name)[1] = product_id
--    Autorisation si : admin OU le produit appartient au vendeur connecté
--
--    NOTE : storage.foldername(name) est évalué dans le scope externe (où
--    `name` = storage.objects.name, sans ambiguïté). La sous-requête IN
--    ne référence PAS `name`, évitant le conflit avec products.name.

-- Lecture publique : tout le monde peut voir les médias produits
DROP POLICY IF EXISTS "product_media_public_read" ON "storage"."objects";
CREATE POLICY "product_media_public_read"
  ON "storage"."objects"
  FOR SELECT
  TO public
  USING (bucket_id = 'product-media');

-- Écriture : admin OU vendeur propriétaire du produit
DROP POLICY IF EXISTS "product_media_auth_insert" ON "storage"."objects";
CREATE POLICY "product_media_auth_insert"
  ON "storage"."objects"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-media'
    AND (
      public.is_admin()
      OR
      (storage.foldername(name))[1]::uuid IN (
        SELECT p.id
        FROM public.products p
        JOIN public.vendors v ON v.id = p.vendor_id
        WHERE v.profile_id = auth.uid()
      )
    )
  );

-- Mise à jour : admin OU vendeur propriétaire du produit
DROP POLICY IF EXISTS "product_media_auth_update" ON "storage"."objects";
CREATE POLICY "product_media_auth_update"
  ON "storage"."objects"
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-media'
    AND (
      public.is_admin()
      OR
      (storage.foldername(name))[1]::uuid IN (
        SELECT p.id
        FROM public.products p
        JOIN public.vendors v ON v.id = p.vendor_id
        WHERE v.profile_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'product-media'
    AND (
      public.is_admin()
      OR
      (storage.foldername(name))[1]::uuid IN (
        SELECT p.id
        FROM public.products p
        JOIN public.vendors v ON v.id = p.vendor_id
        WHERE v.profile_id = auth.uid()
      )
    )
  );

-- Suppression : admin OU vendeur propriétaire du produit
DROP POLICY IF EXISTS "product_media_auth_delete" ON "storage"."objects";
CREATE POLICY "product_media_auth_delete"
  ON "storage"."objects"
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-media'
    AND (
      public.is_admin()
      OR
      (storage.foldername(name))[1]::uuid IN (
        SELECT p.id
        FROM public.products p
        JOIN public.vendors v ON v.id = p.vendor_id
        WHERE v.profile_id = auth.uid()
      )
    )
  );
