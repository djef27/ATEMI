// Pure helpers for delivery zone lookups (unit-testable, no I/O)

/** Normalise une saisie de ville : accents retirés, minuscules, espaces réduits. */
export function normalizeCity(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Listes canoniques de villes par pays (affichage + suggestion du checkout). */
export const DELIVERY_COUNTRIES = ['BJ', 'CI', 'TG'] as const;

export type DeliveryCountry = (typeof DELIVERY_COUNTRIES)[number];

export function isSupportedCountry(country: string | null): country is DeliveryCountry {
  return !!country && (DELIVERY_COUNTRIES as readonly string[]).includes(country);
}

/**
 * PostgREST error code for a missing column (`42703 undefined_column`).
 *
 * `delivery_zones.city_normalized` is added by
 * `supabase/migrations/20260924000000_delivery_zones_benin_v2.sql`. Until that
 * migration is applied, any query filtering on it fails outright, which would
 * leave the checkout with no city at all. The callers catch this code and retry
 * with an in-memory normalisation instead.
 */
export const UNDEFINED_COLUMN_ERROR = '42703';

export function isUndefinedColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === UNDEFINED_COLUMN_ERROR;
}

/** Agrège des lignes `delivery_zones` en une entrée par ville (frais min + nb de zones). */
export function groupCitiesByName(
  rows: Array<{ city: string; delivery_fee: number | string }>
): Array<{ name: string; min_fee: number; zones_count: number }> {
  const byCity = new Map<string, { min_fee: number; zones_count: number }>();

  for (const row of rows) {
    const fee = Number(row.delivery_fee);
    const current = byCity.get(row.city);
    if (current) {
      current.min_fee = Math.min(current.min_fee, fee);
      current.zones_count += 1;
    } else {
      byCity.set(row.city, { min_fee: fee, zones_count: 1 });
    }
  }

  return Array.from(byCity.entries())
    .map(([name, meta]) => ({ name, ...meta }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}