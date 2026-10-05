import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request';
import {
  normalizeCity,
  isSupportedCountry,
  isUndefinedColumnError,
  groupCitiesByName,
} from '@/lib/delivery-zones';

// ---------------------------------------------------------------------------
// GET /api/delivery-zones?city=…&country=…   → zones de livraison d'une ville
// GET /api/delivery-zones?cities=1&country=… → liste des villes couvertes
//
// La colonne générée `city_normalized` (migration 20260924000000) permet une
// recherche insensible aux accents. Tant qu'elle n'est pas déployée, la requête
// échoue en 42703 : on retombe alors sur un filtrage en mémoire (le(tableau des
// zones du pays est petit) pour ne pas casser le checkout en attendant.
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

    if (!isSupportedCountry(country)) {
      return NextResponse.json(
        { success: false, error: 'Pays non pris en charge' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
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

      return NextResponse.json({ success: true, data: groupCitiesByName(data || []) });
    }

    if (!city || !city.trim()) {
      return NextResponse.json(
        { success: false, error: 'Ville requise' },
        { status: 400 }
      );
    }

    // Comparaison insensible aux accents / à la casse / aux espaces inutiles
    const normalized = normalizeCity(city);

    let rows: ZoneRow[] | null = null;
    let error: { code?: string; message?: string } | null = null;

    ({ data: rows, error } = await base
      .eq('city_normalized', normalized)
      .order('zone_name'));

    if (error && isUndefinedColumnError(error)) {
      // Fallback : on récupère les zones du pays et on normalise en mémoire.
      console.warn('[DELIVERY_ZONES_FALLBACK] city_normalized absent — migration 20260924000000 à déployer');
      const fallback = await base.order('city');
      if (fallback.error) {
        console.error('[DELIVERY_ZONES_ERROR]', fallback.error.message);
        return NextResponse.json(
          { success: false, data: [], error: 'Erreur lors du chargement des zones' },
          { status: 500 }
        );
      }
      rows = (fallback.data || []).filter((z) => normalizeCity(z.city) === normalized);
    } else if (error) {
      console.error('[DELIVERY_ZONES_ERROR]', error.message);
      return NextResponse.json(
        { success: false, data: [], error: 'Erreur lors du chargement des zones' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: (rows || []).map(toZone) });
  } catch {
    console.error('[DELIVERY_ZONES_ERROR] Internal error');
    return NextResponse.json({ success: false, data: [], error: 'Erreur interne' }, { status: 500 });
  }
}
