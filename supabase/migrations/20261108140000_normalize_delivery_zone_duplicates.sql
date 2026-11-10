-- Normalize zone labels per country/city and deduplicate equivalent entries.
-- Historical order references are redirected to the retained zone row first.

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS city_name_normalized TEXT GENERATED ALWAYS AS (
    translate(
      lower(regexp_replace(btrim(city), '\s+', ' ', 'g')),
      'àâäáãéèêëìíîïòóôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    )
  ) STORED;

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS zone_name_normalized TEXT GENERATED ALWAYS AS (
    translate(
      lower(regexp_replace(btrim(zone_name), '\s+', ' ', 'g')),
      'àâäáãéèêëìíîïòóôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    )
  ) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'delivery_zones'
      AND column_name = 'city_normalized'
  ) THEN
    RAISE EXCEPTION 'delivery_zones.city_normalized is required before zone deduplication';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.delivery_zones
    GROUP BY country, city_normalized, zone_name_normalized
    HAVING COUNT(*) > 1
      AND (
        COUNT(DISTINCT delivery_fee) > 1
        OR COUNT(DISTINCT is_available) > 1
        OR COUNT(DISTINCT is_active) > 1
      )
  ) THEN
    RAISE EXCEPTION 'Ambiguous duplicate delivery zones have different fees or availability';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.delivery_zones'::regclass
      AND conrelid <> 'public.orders'::regclass
  ) THEN
    RAISE EXCEPTION 'Ambiguous delivery zone references outside orders require manual migration review';
  END IF;
END
$$;

WITH ranked_zones AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY country, city_name_normalized, zone_name_normalized
      ORDER BY id
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY country, city_name_normalized, zone_name_normalized
      ORDER BY id
    ) AS duplicate_rank
  FROM public.delivery_zones
),
duplicate_zones AS (
  SELECT id, canonical_id
  FROM ranked_zones
  WHERE duplicate_rank > 1
)
UPDATE public.orders AS orders
SET delivery_zone_id = duplicates.canonical_id
FROM duplicate_zones AS duplicates
WHERE orders.delivery_zone_id = duplicates.id;

WITH ranked_zones AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY country, city_name_normalized, zone_name_normalized
      ORDER BY id
    ) AS duplicate_rank
  FROM public.delivery_zones
)
DELETE FROM public.delivery_zones AS zones
USING ranked_zones
WHERE zones.id = ranked_zones.id
  AND ranked_zones.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_zones_country_city_zone_normalized
  ON public.delivery_zones (country, city_name_normalized, zone_name_normalized);
