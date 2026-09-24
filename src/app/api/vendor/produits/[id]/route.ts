import { NextRequest, NextResponse } from 'next/server';
import { productUpdateSchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import {
  requireVendorAuth,
  requireProductOwner,
  isAllowedOrigin,
} from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// GET /api/vendor/produits/[id] — Get a single product with images
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireVendorAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const productCheck = await requireProductOwner(auth.supabase, id, auth.vendorId, auth.isAdmin);
    if ('error' in productCheck) return productCheck.error;

    // Fetch images
    const { data: images } = await auth.supabase
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      success: true,
      data: { ...productCheck.product, images: images || [] },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/vendor/produits/[id] — Update a product
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireVendorAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const productCheck = await requireProductOwner(auth.supabase, id, auth.vendorId, auth.isAdmin);
    if ('error' in productCheck) return productCheck.error;
    const existing = productCheck.product;

    // Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const updates = parsed.data;

    // Build update object
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
      const newSlug = slugify(updates.name);
      const { data: slugConflict } = await auth.supabase
        .from('products')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', id)
        .limit(1);

      if (slugConflict && slugConflict.length > 0) {
        return NextResponse.json({ success: false, error: 'Un produit avec ce nom existe déjà' }, { status: 409 });
      }
      updateData.slug = newSlug;
    }

    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.supplier_price !== undefined) updateData.supplier_price = updates.supplier_price;
    if (updates.stock !== undefined) updateData.stock = updates.stock;
    if (updates.status !== undefined) updateData.status = updates.status;

    // Recalculate deposit/remaining if price or deposit_rate changed
    if (updates.selling_price !== undefined || updates.deposit_rate !== undefined || updates.supplier_price !== undefined) {
      const price = updates.selling_price ?? (existing.selling_price as number);
      const rate = updates.deposit_rate ?? (existing.deposit_rate as number);
      const supplier = updates.supplier_price ?? (existing.supplier_price as number);
      updateData.selling_price = price;
      updateData.deposit_rate = rate;
      updateData.supplier_price = supplier;
      updateData.deposit_amount = Math.round(price * rate / 100);
      updateData.remaining_amount = supplier;
    }

    // Validate category if changed
    if (updates.category_id !== undefined) {
      const { data: category } = await auth.supabase
        .from('categories')
        .select('id')
        .eq('id', updates.category_id)
        .eq('is_active', true)
        .limit(1);

      if (!category || category.length === 0) {
        return NextResponse.json({ success: false, error: 'Veuillez sélectionner une catégorie valide pour votre produit' }, { status: 400 });
      }
      updateData.category_id = updates.category_id;
    }

    // Auto-update status to out_of_stock if stock reaches 0
    if (typeof updateData.stock === 'number' && updateData.stock === 0 && (existing.stock as number) > 0) {
      updateData.status = 'out_of_stock';
    } else if (typeof updateData.stock === 'number' && updateData.stock > 0 && existing.status === 'out_of_stock') {
      updateData.status = 'active';
    }

    const { data: product, error: updateError } = await auth.supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la modification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: product });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/vendor/produits/[id] — Soft delete (trash) a product
//
// Sets deleted_at = now(). Product enters 48h trash before permanent deletion.
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireVendorAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const productCheck = await requireProductOwner(auth.supabase, id, auth.vendorId, auth.isAdmin);
    if ('error' in productCheck) return productCheck.error;

    // Soft delete: set deleted_at and status to inactive
    const now = new Date().toISOString();
    const { error: updateError } = await auth.supabase
      .from('products')
      .update({
        deleted_at: now,
        status: 'inactive',
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la suppression' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Produit déplacé vers la corbeille (suppression dans 48h)',
      deleted_at: now,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// Reject PUT
export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}
