import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { deliveryZoneCreateSchema } from '@/lib/validations';
import { normalizeCity, isSupportedCountry, isUndefinedColumnError } from '@/lib/delivery-zones';
import { isGeographicCountry } from '@/lib/geography-data';

// ---------------------------------------------------------------------------
// GET /api/admin/delivery-zones — lister les zones de livraison
//   ?country=BJ              (défaut) | ?active=true|false
//   ?city=Cotonou            filtrer sur une ville précise
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (request, { supabase }) => {
  const url = new URL(request.url);
  const country = (url.searchParams.get('country') || 'BJ').toUpperCase();
  const city = url.searchParams.get('city');
  const active = url.searchParams.get('active');

  if (!isSupportedCountry(country) || !isGeographicCountry(country)) {
    return NextResponse.json({ success: false, error: 'Pays non pris en charge' }, { status: 400 });
  }

  const run = () => {
    let query = supabase
      .from('delivery_zones')
      .select('*')
      .eq('country', country)
      .order('city', { ascending: true })
      .order('delivery_fee', { ascending: true });

    if (active && active !== 'all') {
      query = query.eq('is_active', active === 'true');
    }
    return query;
  };

  let data, error;

  if (city) {
    // Filtre ville via la colonne générée city_normalized.
    const result = await run().eq('city_normalized', normalizeCity(city));
    data = result.data;
    error = result.error;

    if (error && isUndefinedColumnError(error)) {
      // Migration 20260924000000 pas encore déployée : filtrage en mémoire.
      const all = await run();
      if (all.error) {
        return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
      }
      const normalized = normalizeCity(city);
      data = (all.data || []).filter((z) => normalizeCity(String(z.city)) === normalized);
      error = null;
    }
  } else {
    const result = await run();
    data = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
});

// ---------------------------------------------------------------------------
// POST /api/admin/delivery-zones — créer une zone (duplicata → 409)
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (request, { supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
  }

  const parsed = deliveryZoneCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { country, city, zone_name, delivery_fee, is_available } = parsed.data;

  if (!isSupportedCountry(country) || !isGeographicCountry(country)) {
    return NextResponse.json(
      { success: false, error: 'Pays non pris en charge' },
      { status: 400 }
    );
  }

  const cityNormalized = normalizeCity(city);
  const trimmedZoneName = zone_name.trim();
  const zoneNameNormalized = normalizeCity(trimmedZoneName);

  // The normalized columns are added by the duplicate-cleanup migration.
  // Keep the in-memory fallback for deployments not migrated yet.
  const duplicateQuery = () =>
    supabase
      .from('delivery_zones')
      .select('id, city, zone_name')
      .eq('country', country);

  const normalizedLookup = await duplicateQuery()
    .eq('city_name_normalized', cityNormalized)
    .eq('zone_name_normalized', zoneNameNormalized);
  let duplicates: Array<{ id: string; city: string; zone_name: string }> = normalizedLookup.data || [];

  if (normalizedLookup.error && isUndefinedColumnError(normalizedLookup.error)) {
    const all = await duplicateQuery();
    if (all.error) {
      return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
    }
    duplicates = (all.data || []).filter((z) =>
      normalizeCity(String(z.city)) === cityNormalized &&
      normalizeCity(String(z.zone_name)) === zoneNameNormalized
    );
  } else if (normalizedLookup.error) {
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
  }

  if (duplicates.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Cette ville contient déjà une zone identique' },
      { status: 409 }
    );
  }

  const { data: zone, error: insertError } = await supabase
    .from('delivery_zones')
    .insert({
      country,
      city: city.trim(),
      zone_name: trimmedZoneName,
      delivery_fee,
      is_available,
      is_active: true,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Cette ville contient déjà une zone identique' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: 'Erreur lors de la création' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: zone });
});