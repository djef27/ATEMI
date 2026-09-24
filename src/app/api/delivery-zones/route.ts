import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const rl = await checkRateLimit(`dz:${ip}`, RATE_LIMIT_CONFIGS.general);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');

    if (!city) {
      return NextResponse.json(
        { success: false, error: 'Ville requise' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('id, zone_name, delivery_fee, city')
      .ilike('city', city.trim())
      .eq('is_active', true)
      .eq('is_available', true);

    if (error) {
      console.error('[DELIVERY_ZONES_ERROR]', error.message);
      return NextResponse.json({ success: false, data: [], error: 'Erreur lors du chargement des zones' }, { status: 500 });
    }

    const zones = (data || []).map((z) => ({
      id: z.id,
      name: z.zone_name,
      fee: z.delivery_fee,
      city: z.city,
    }));

    return NextResponse.json({ success: true, data: zones });
  } catch {
    console.error('[DELIVERY_ZONES_ERROR] Internal error');
    return NextResponse.json({ success: false, data: [], error: 'Erreur interne' }, { status: 500 });
  }
}
