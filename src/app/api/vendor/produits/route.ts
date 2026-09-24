import { NextRequest, NextResponse } from 'next/server';
import { productCreateSchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import { requireVendorAuth, isAllowedOrigin } from '@/lib/auth-helpers';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { success: false, error: 'Origine non autorisée' },
        { status: 403 }
      );
    }

    const auth = await requireVendorAuth(request);
    if ('error' in auth) return auth.error;

    const rl = await checkRateLimit(auth.vendorId, RATE_LIMIT_CONFIGS.vendorProductMutation);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Trop de requêtes. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)}s` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
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

    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const vendorId = auth.vendorId;

    // Vendor can only create products for their own shop
    if (parsed.data.vendor_id !== vendorId) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez créer des produits que pour votre propre boutique' },
        { status: 403 }
      );
    }

    const { deposit_rate, selling_price, supplier_price } = parsed.data;

    const deposit_amount = Math.round(selling_price * deposit_rate / 100);
    const remaining_amount = selling_price - deposit_amount;

    const { data: category } = await auth.supabase
      .from('categories')
      .select('id')
      .eq('id', parsed.data.category_id)
      .eq('is_active', true)
      .limit(1);

    if (!category || category.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Veuillez sélectionner une catégorie valide pour votre produit' },
        { status: 400 }
      );
    }

    const slug = slugify(parsed.data.name);

    const { data: existingSlug } = await auth.supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .limit(1);

    if (existingSlug && existingSlug.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Un produit avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    const { data: product, error: insertError } = await auth.supabase
      .from('products')
      .insert({
        vendor_id: vendorId,
        category_id: parsed.data.category_id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description ?? null,
        supplier_price: parsed.data.supplier_price,
        selling_price,
        deposit_rate: parsed.data.deposit_rate ?? 50,
        deposit_amount,
        remaining_amount,
        stock: parsed.data.stock,
        status: parsed.data.status,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la création du produit' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: product });
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
