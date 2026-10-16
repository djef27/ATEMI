import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request';
import { z } from 'zod';

const stockCheckSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 30 stock checks per minute per IP
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`stock:${ip}`, RATE_LIMIT_CONFIGS.general);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429 }
      );
    }

    const parsed = stockCheckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Articles invalides' },
        { status: 400 }
      );
    }
    const { items } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const issues: Array<{ product_id: string; name: string; requested: number; available: number }> = [];

    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('id, name, stock')
        .eq('id', item.product_id)
        .single();

      if (error || !product) {
        issues.push({
          product_id: item.product_id,
          name: 'Produit inconnu',
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      if (product.stock < item.quantity) {
        issues.push({
          product_id: product.id,
          name: product.name,
          requested: item.quantity,
          available: product.stock,
        });
      }
    }

    return NextResponse.json({ success: true, issues });
  } catch {
    console.error('[STOCK_CHECK_ERROR] Unexpected error during stock validation');
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la vérification du stock' },
      { status: 500 }
    );
  }
}
