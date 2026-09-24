-- Migration: Add is_active column + seed delivery zones for Benin
-- The remote schema is missing is_active, but the API and RLS policies reference it.

-- 1. Add is_active column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_zones' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.delivery_zones ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- 2. Create index on city if missing
CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON public.delivery_zones USING btree (city);

-- 3. Seed delivery zones for major cities in Benin
INSERT INTO public.delivery_zones (country, city, zone_name, delivery_fee, is_available, is_active)
VALUES
  -- Cotonou
  ('BJ', 'Cotonou', 'Centre-ville', 1000, true, true),
  ('BJ', 'Cotonou', 'Haie-Vive', 1500, true, true),
  ('BJ', 'Cotonou', 'Cadjèhè', 1500, true, true),
  ('BJ', 'Cotonou', 'Agla', 2000, true, true),
  ('BJ', 'Cotonou', 'Fidjrossè', 2000, true, true),
  ('BJ', 'Cotonou', 'Togba', 2500, true, true),
  ('BJ', 'Cotonou', 'Sèmè-Podji', 3000, true, true),
  ('BJ', 'Cotonou', 'Akpakpa', 2000, true, true),
  ('BJ', 'Cotonou', 'Godomey', 3000, true, true),
  ('BJ', 'Cotonou', 'Possotomé', 3500, true, true),

  -- Porto-Novo
  ('BJ', 'Porto-Novo', 'Centre-ville', 1500, true, true),
  ('BJ', 'Porto-Novo', 'Avèkèrou', 2000, true, true),
  ('BJ', 'Porto-Novo', 'Togba', 2000, true, true),
  ('BJ', 'Porto-Novo', 'Sèmè-Kpodji', 3000, true, true),

  -- Parakou
  ('BJ', 'Parakou', 'Centre-ville', 2500, true, true),
  ('BJ', 'Parakou', 'Banikanni', 3000, true, true),
  ('BJ', 'Parakou', 'Ganrou', 3500, true, true),

  -- Bohicon
  ('BJ', 'Bohicon', 'Centre-ville', 2000, true, true),
  ('BJ', 'Bohicon', 'Agongblan', 2500, true, true),

  -- Abomey
  ('BJ', 'Abomey', 'Centre-ville', 2500, true, true),
  ('BJ', 'Abomey', 'Zounmè', 3000, true, true),

  -- Ouidah
  ('BJ', 'Ouidah', 'Centre-ville', 2500, true, true),
  ('BJ', 'Ouidah', 'Kpota', 3000, true, true),

  -- Natitingou
  ('BJ', 'Natitingou', 'Centre-ville', 4000, true, true),
  ('BJ', 'Natitingou', 'Tanguiéta', 5000, true, true),

  -- Lokossa
  ('BJ', 'Lokossa', 'Centre-ville', 2000, true, true),
  ('BJ', 'Lokossa', 'Ahorou-Tomegbe', 2500, true, true),

  -- Comè
  ('BJ', 'Comè', 'Centre-ville', 2500, true, true),

  -- Grand-Popo
  ('BJ', 'Grand-Popo', 'Centre-ville', 3500, true, true),

  -- Kandi
  ('BJ', 'Kandi', 'Centre-ville', 5000, true, true),

  -- Dogbo
  ('BJ', 'Dogbo', 'Centre-ville', 3000, true, true),

  -- Dassa-Zoumè
  ('BJ', 'Dassa-Zoumè', 'Centre-ville', 3000, true, true),

  -- Savalou
  ('BJ', 'Savalou', 'Centre-ville', 3500, true, true),

  -- Covè
  ('BJ', 'Covè', 'Centre-ville', 2500, true, true),

  -- Glazoué
  ('BJ', 'Glazoué', 'Centre-ville', 3000, true, true),

  -- Malanville
  ('BJ', 'Malanville', 'Centre-ville', 6000, true, true),

  -- Boukoumbé
  ('BJ', 'Boukoumbé', 'Centre-ville', 5000, true, true),

  -- Tanguiéta
  ('BJ', 'Tanguiéta', 'Centre-ville', 5000, true, true)

ON CONFLICT (country, city, zone_name) DO NOTHING;
