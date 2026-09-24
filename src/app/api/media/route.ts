import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAuth, isAllowedOrigin } from '@/lib/auth-helpers';
import { z } from 'zod';

const mediaItemSchema = z.object({
  image_url: z.string().url('URL invalide').max(2000),
  alt_text: z.string().max(500).default(''),
  sort_order: z.number().int().min(0).default(0),
  is_primary: z.boolean().default(false),
  media_type: z.enum(['image', 'video']).default('image'),
});

const mediaInsertSchema = z.object({
  product_id: z.string().uuid('product_id invalide'),
  media: z.array(mediaItemSchema).min(1, 'Au moins un média requis').max(10, 'Trop de médias'),
});

const MAX_URL_LENGTH = 2000;

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { success: false, error: 'Origine non autorisée' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body invalide' },
        { status: 400 }
      );
    }

    const parsed = mediaInsertSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { product_id, media } = parsed.data;

    for (const m of media) {
      if (m.image_url.length > MAX_URL_LENGTH) {
        return NextResponse.json(
          { success: false, error: 'URL de média trop longue' },
          { status: 400 }
        );
      }
    }

    const auth = await requireVendorAuth(request);
    if ('error' in auth) return auth.error;

    // Verify product ownership (unless admin)
    if (!auth.isAdmin) {
      const { data: product } = await auth.supabase
        .from('products')
        .select('id')
        .eq('id', product_id)
        .eq('vendor_id', auth.vendorId)
        .limit(1);

      if (!product || product.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Produit introuvable ou non autorisé' },
          { status: 403 }
        );
      }
    }

    const { error: insertError } = await auth.supabase
      .from('product_images')
      .insert(media.map(m => ({
        product_id,
        image_url: m.image_url,
        alt_text: m.alt_text || '',
        sort_order: m.sort_order,
        is_primary: m.is_primary,
        media_type: m.media_type,
      })));

    if (insertError) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'enregistrement des médias' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}
