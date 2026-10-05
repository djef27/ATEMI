import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { deliveryZoneUpdateSchema } from '@/lib/validations';
import { normalizeCity, isUndefinedColumnError } from '@/lib/delivery-zones';

// ---------------------------------------------------------------------------
// PATCH /api/admin/delivery-zones/[id] — modifier / activer-désactiver une zone
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
  }

  const parsed = deliveryZoneUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: 'Zone introuvable' }, { status: 404 });
  }

  const updates = parsed.data;
  const nextCity = updates.city !== undefined ? updates.city.trim() : existing.city;
  const nextZoneName = updates.zone_name !== undefined ? updates.zone_name.trim() : existing.zone_name;

  // Vérification de duplicata si ville ou nom de zone changé
  if (
    (updates.city !== undefined && normalizeCity(updates.city) !== normalizeCity(existing.city)) ||
    (updates.zone_name !== undefined && updates.zone_name.trim() !== existing.zone_name)
  ) {
    const conflictQuery = () =>
      supabase
        .from('delivery_zones')
        .select('id, city')
        .eq('country', existing.country)
        .eq('zone_name', nextZoneName)
        .neq('id', id);

    const normalizedLookup = await conflictQuery().eq('city_normalized', normalizeCity(nextCity));
    let conflicts: Array<{ id: string; city: string }> = normalizedLookup.data || [];

    if (normalizedLookup.error && isUndefinedColumnError(normalizedLookup.error)) {
      const all = await conflictQuery();
      if (all.error) {
        return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
      }
      const normalized = normalizeCity(nextCity);
      conflicts = (all.data || []).filter((z) => normalizeCity(String(z.city)) === normalized);
    } else if (normalizedLookup.error) {
      return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cette ville contient déjà une zone identique' },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.city !== undefined) updateData.city = updates.city.trim();
  if (updates.zone_name !== undefined) updateData.zone_name = updates.zone_name.trim();
  if (updates.delivery_fee !== undefined) updateData.delivery_fee = updates.delivery_fee;
  if (updates.is_available !== undefined) updateData.is_available = updates.is_available;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data: zone, error: updateError } = await supabase
    .from('delivery_zones')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la modification' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: zone });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/delivery-zones/[id] — désactiver (suppression souple)
// (les zones sont référencées par orders.delivery_zone_id, on garde l'historique)
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from('delivery_zones')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: 'Zone introuvable' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('delivery_zones')
    .update({ is_active: false, is_available: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la désactivation' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Zone désactivée' });
});

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}