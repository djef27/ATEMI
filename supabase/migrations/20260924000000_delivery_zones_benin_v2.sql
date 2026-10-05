-- Migration: Corriger + étendre les zones de livraison Bénin (adresses & villes)
--
-- Corrections apportées :
--  * normalise country 'Bénin' -> 'BJ' (référentiel de code pays cohérent)
--  * supprime des zones mal classées (Possotomé, Sèmè-Podji, Togba sous
--    Cotonou ; Togba / Sèmè-Kpodji sous Porto-Novo)
--  * ajoute les grandes communes manquantes (Abomey-Calavi, Djougou, Allada,
--    Sakété, Pobè, Kétou, Savè, Djidja, Tchaourou, Banikoara, …)
--  * garantit une contrainte unique (country, city, zone_name) pour des
--    upserts déterministes et un CRUD admin fiable
--
-- Les IDs existants sont conservés (références orders.delivery_zone_id).

-- 1. Normaliser le pays (les anciennes lignes utilisaient 'Bénin')
UPDATE public.delivery_zones SET country = 'BJ' WHERE country <> 'BJ';

-- 2. Dédupliquer (country, city, zone_name) en gardant le plus petit id
DELETE FROM public.delivery_zones a
USING public.delivery_zones b
WHERE a.id > b.id
  AND a.country = b.country
  AND a.city = b.city
  AND a.zone_name = b.zone_name;

-- 3. Contrainte unique (permet ON CONFLICT DO UPDATE / DO NOTHING)
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_zones_country_city_zone
  ON public.delivery_zones (country, city, zone_name);

-- 3b. Colonne générée pour une recherche de ville insensible aux accents
--     (utilisée par GET /api/delivery-zones et l'admin)
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS city_normalized TEXT GENERATED ALWAYS AS
  (translate(lower(city), 'àâäáãéèêëìíîïòóôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) STORED;

CREATE INDEX IF NOT EXISTS idx_delivery_zones_city_normalized
  ON public.delivery_zones (city_normalized);

-- 4. Retirer les zones mal localisées
DELETE FROM public.delivery_zones
WHERE (country = 'BJ' AND city = 'Cotonou'   AND zone_name IN ('Possotomé', 'Sèmè-Podji', 'Togba'))
   OR (country = 'BJ' AND city = 'Porto-Novo' AND zone_name IN ('Togba', 'Sèmè-Kpodji'));

-- 5. Référentiel corrigé et étendu (BJ) — upsert : ajuste les frais existants
INSERT INTO public.delivery_zones (country, city, zone_name, delivery_fee, is_available, is_active)
VALUES
  -- Cotonou (Littoral)
  ('BJ', 'Cotonou', 'Centre-Ville', 1000, true, true),
  ('BJ', 'Cotonou', 'Cadjehoun', 1500, true, true),
  ('BJ', 'Cotonou', 'Cadjèhè', 1500, true, true),
  ('BJ', 'Cotonou', 'Haie-Vive', 1500, true, true),
  ('BJ', 'Cotonou', 'Fifadji', 2000, true, true),
  ('BJ', 'Cotonou', 'Saint-Jean', 2000, true, true),
  ('BJ', 'Cotonou', 'Akpakpa', 2000, true, true),
  ('BJ', 'Cotonou', 'Agla', 2000, true, true),
  ('BJ', 'Cotonou', 'Fidjrossè', 2000, true, true),
  ('BJ', 'Cotonou', 'Gbégamey', 2500, true, true),
  ('BJ', 'Cotonou', 'Védoko', 2500, true, true),
  ('BJ', 'Cotonou', 'Godomey', 3000, true, true),
  ('BJ', 'Cotonou', 'Tokplégbé', 3000, true, true),

  -- Abomey-Calavi (Atlantique — grande banlieue)
  ('BJ', 'Abomey-Calavi', 'Calavi / Hêvié', 2500, true, true),
  ('BJ', 'Abomey-Calavi', 'Akassato', 3000, true, true),
  ('BJ', 'Abomey-Calavi', 'Zinvié', 3500, true, true),
  ('BJ', 'Abomey-Calavi', 'Glo-Djigbé', 3500, true, true),

  -- Porto-Novo (Ouémé)
  ('BJ', 'Porto-Novo', 'Centre-Ville', 1500, true, true),
  ('BJ', 'Porto-Novo', 'Avèkèrou', 2000, true, true),

  -- Sèmè-Podji (Ouémé — axe littoral)
  ('BJ', 'Sèmè-Podji', 'Agblangandan', 3000, true, true),
  ('BJ', 'Sèmè-Podji', 'Ekpè', 3500, true, true),

  -- Ouidah (Atlantique)
  ('BJ', 'Ouidah', 'Centre-Ville', 2500, true, true),
  ('BJ', 'Ouidah', 'Kpota', 3000, true, true),

  -- Autres communes Atlantique
  ('BJ', 'Allada', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Grand-Popo', 'Centre-Ville', 3500, true, true),

  -- Zou
  ('BJ', 'Abomey', 'Centre-Ville', 2500, true, true),
  ('BJ', 'Abomey', 'Zounmè', 3000, true, true),
  ('BJ', 'Bohicon', 'Centre-Ville', 2000, true, true),
  ('BJ', 'Bohicon', 'Agongblan', 2500, true, true),
  ('BJ', 'Djidja', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Covè', 'Centre-Ville', 2500, true, true),
  ('BJ', 'Zagnanado', 'Centre-Ville', 3000, true, true),

  -- Collines
  ('BJ', 'Dassa-Zoumè', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Savalou', 'Centre-Ville', 3500, true, true),
  ('BJ', 'Glazoué', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Savè', 'Centre-Ville', 3500, true, true),
  ('BJ', 'Ouèssè', 'Centre-Ville', 4000, true, true),
  ('BJ', 'Bantè', 'Centre-Ville', 4000, true, true),

  -- Mono / Couffo
  ('BJ', 'Lokossa', 'Centre-Ville', 2000, true, true),
  ('BJ', 'Lokossa', 'Ahorou-Tomegbe', 2500, true, true),
  ('BJ', 'Athiémé', 'Centre-Ville', 2500, true, true),
  ('BJ', 'Bopa', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Comè', 'Centre-Ville', 2500, true, true),
  ('BJ', 'Dogbo', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Aplahoué', 'Centre-Ville', 3000, true, true),

  -- Plateau
  ('BJ', 'Pobè', 'Centre-Ville', 3500, true, true),
  ('BJ', 'Sakété', 'Centre-Ville', 3000, true, true),
  ('BJ', 'Kétou', 'Centre-Ville', 3500, true, true),
  ('BJ', 'Adja-Ouèrè', 'Centre-Ville', 3500, true, true),

  -- Borgou / Alibori
  ('BJ', 'Parakou', 'Centre-Ville', 2500, true, true),
  ('BJ', 'Parakou', 'Banikanni', 3000, true, true),
  ('BJ', 'Parakou', 'Ganrou', 3500, true, true),
  ('BJ', 'Tchaourou', 'Centre-Ville', 4000, true, true),
  ('BJ', 'Nikki', 'Centre-Ville', 6000, true, true),
  ('BJ', 'Bembèrèkè', 'Centre-Ville', 5500, true, true),
  ('BJ', 'Sinendé', 'Centre-Ville', 5500, true, true),
  ('BJ', 'Kandi', 'Centre-Ville', 5000, true, true),
  ('BJ', 'Banikoara', 'Centre-Ville', 6000, true, true),
  ('BJ', 'Malanville', 'Centre-Ville', 6000, true, true),
  ('BJ', 'Ségbana', 'Centre-Ville', 6000, true, true),
  ('BJ', 'Gogounou', 'Centre-Ville', 5500, true, true),

  -- Atacora / Donga
  ('BJ', 'Natitingou', 'Centre-Ville', 4000, true, true),
  ('BJ', 'Tanguiéta', 'Centre-Ville', 5000, true, true),
  ('BJ', 'Boukoumbé', 'Centre-Ville', 5000, true, true),
  ('BJ', 'Kouandé', 'Centre-Ville', 4500, true, true),
  ('BJ', 'Djougou', 'Centre-Ville', 4000, true, true),
  ('BJ', 'Djougou', 'Gbéléban', 4500, true, true),
  ('BJ', 'Bassila', 'Centre-Ville', 5000, true, true)

ON CONFLICT (country, city, zone_name) DO UPDATE SET
  delivery_fee = EXCLUDED.delivery_fee,
  is_available = EXCLUDED.is_available,
  is_active = EXCLUDED.is_active,
  updated_at = now();