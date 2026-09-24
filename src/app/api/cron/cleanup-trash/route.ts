import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// GET /api/cron/cleanup-trash — Auto-delete expired trash products (>48h)
//                                AND clean up expired idempotency keys (>24h)
//
// Called by external cron (e.g. Vercel Cron, GitHub Actions, or manual).
// In development, can be called directly.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (in production)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      // In production, CRON_SECRET must be set
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, error: 'Configuration manquante' }, { status: 500 });
      }
      // In development, allow unauthenticated access
    } else if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const results: { trash?: number; idempotency?: number } = {};

    // 1. Clean up expired trash products (>48h)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: expiredProducts } = await supabase
      .from('products')
      .select('id')
      .not('deleted_at', 'is', null)
      .lte('deleted_at', cutoff);

    if (expiredProducts && expiredProducts.length > 0) {
      const productIds = expiredProducts.map(p => p.id);

      await supabase.from('product_images').delete().in('product_id', productIds);
      const { count } = await supabase.from('products').delete().in('id', productIds);
      results.trash = count || productIds.length;
    } else {
      results.trash = 0;
    }

    // 2. Clean up expired idempotency keys (>24h)
    const idempotencyCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: idempCount } = await supabase
      .from('idempotency_keys')
      .delete()
      .lt('created_at', idempotencyCutoff);

    results.idempotency = idempCount || 0;

    return NextResponse.json({
      success: true,
      deleted_trash: results.trash,
      deleted_idempotency: results.idempotency,
      message: `${results.trash} produit(s) et ${results.idempotency} clé(s) d'idempotence nettoyé(s)`,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
