import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request';
import {
  normalizeCity,
  isSupportedCountry,
  groupCitiesByName,
} from '@/lib/delivery-zones';
import { getSubdivisionCodesForCities, isGeographicCountry } from '@/lib/geography-data';

// ---------------------------------------------------------------------------
// GET /api/delivery-zones?city=…&country=…   → zones de livraison d'une ville
// GET /api/delivery-zones?cities=1&country=… → liste des villes couvertes
//
// Les villes sont normalisées en mémoire pour que le checkout ne dépende pas
// d'une colonne SQL générée qui peut être absente ou périmée.
// ---------------------------------------------------------------------------

type ZoneRow = {
  id: string;
  city: string;
  zone_name: string;
  delivery_fee: number | string;
};

function toZone(row: ZoneRow) {
  return {
    id: row.id,
    name: row.zone_name,
    fee: Number(row.delivery_fee),
    city: row.city,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 requests per minute per IP
    const rl = await checkRateLimit(`dz:${getClientIp(request)}`, RATE_LIMIT_CONFIGS.general);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const country = (searchParams.get('country') || 'BJ').toUpperCase();

    if (!isSupportedCountry(country) || !isGeographicCountry(country)) {
      return NextResponse.json(
        { success: false, error: 'Pays non pris en charge' },
        { status: 400 }
      );
    }

    // RLS may hide valid delivery zones from anonymous checkout visitors.
    // Use the server-only admin client, then expose only active public fields.
    const supabase = createAdminSupabaseClient();
    const base = supabase
      .from('delivery_zones')
      .select('id, city, zone_name, delivery_fee')
      .eq('country', country)
      .eq('is_active', true)
      .eq('is_available', true);

    // Mode "catalogue des villes" pour l'autocomplétion du checkout.
    // N'utilise pas city_normalized : pas de repli nécessaire ici.
    if (searchParams.get('cities') === '1' || searchParams.get('cities') === 'true') {
      const { data, error } = await base.order('city');

      if (error) {
        console.error('[DELIVERY_ZONES_ERROR]', error.message);
        return NextResponse.json(
          { success: false, data: [], error: 'Erreur lors du chargement des villes' },
          { status: 500 }
        );
      }

      const groupedCities = groupCitiesByName(data || []);
      const regionCodes = getSubdivisionCodesForCities(country, groupedCities.map((city) => city.name));
      const cities = groupedCities.map((city) => ({
        ...city,
        region_code: regionCodes.get(normalizeCity(city.name)) || null,
      }));
      return NextResponse.json({ success: true, data: cities });
    }

    if (!city || !city.trim()) {
      return NextResponse.json(
        { success: false, error: 'Ville requise' },
        { status: 400 }
      );
    }

    // The country has a bounded set of zones. Filtering in memory keeps this
    // lookup consistent with order validation and avoids stale generated data.
    const { data: countryZones, error } = await base.order('city');
    if (error) {
      console.error('[DELIVERY_ZONES_ERROR]', error.message);
      return NextResponse.json(
        { success: false, data: [], error: 'Erreur lors du chargement des zones' },
        { status: 500 }
      );
    }

    const normalized = normalizeCity(city);
    const rows = (countryZones || [])
      .filter((zone) => normalizeCity(zone.city) === normalized)
      .sort((a, b) => a.zone_name.localeCompare(b.zone_name, 'fr'));

    return NextResponse.json({ success: true, data: rows.map(toZone) });
  } catch {
    console.error('[DELIVERY_ZONES_ERROR] Internal error');
    return NextResponse.json({ success: false, data: [], error: 'Erreur interne' }, { status: 500 });
  }
}
