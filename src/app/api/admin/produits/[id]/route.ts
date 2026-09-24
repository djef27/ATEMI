import { NextRequest, NextResponse } from 'next/server';
import { productUpdateSchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import { withAdminAuth } from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// GET /api/admin/produits/[id] — Product detail with images
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*, vendors(name)')
    .eq('id', id)
    .single();

  if (productError || !product) {
    return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 });
  }

  const { data: images } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true });

  return NextResponse.json({ success: true, data: { ...product, images: images || [] } });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/produits/[id] — Update product (price, stock, status, fields)
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

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

  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 });
  }

  const updates = parsed.data;
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.name !== undefined && updates.name !== existing.name) {
    const newSlug = slugify(updates.name);
    const { data: slugConflict } = await supabase
      .from('products')
      .select('id')
      .eq('slug', newSlug)
      .neq('id', id)
      .limit(1);

    if (slugConflict && slugConflict.length > 0) {
      return NextResponse.json({ success: false, error: 'Un produit avec ce nom existe déjà' }, { status: 409 });
    }
    updateData.name = updates.name;
    updateData.slug = newSlug;
  }

  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.stock !== undefined) updateData.stock = updates.stock;
  if (updates.status !== undefined) updateData.status = updates.status;

  if (updates.category_id !== undefined) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', updates.category_id)
      .eq('is_active', true)
      .limit(1);

    if (!category || category.length === 0) {
      return NextResponse.json({ success: false, error: 'Veuillez sélectionner une catégorie valide' }, { status: 400 });
    }
    updateData.category_id = updates.category_id;
  }

  // Recompute deposit / remaining when price or rate changes
  if (updates.selling_price !== undefined || updates.deposit_rate !== undefined || updates.supplier_price !== undefined) {
    const price = updates.selling_price ?? (existing.selling_price as number);
    const rate = updates.deposit_rate ?? (existing.deposit_rate as number);
    updateData.selling_price = price;
    updateData.deposit_rate = rate;
    if (updates.supplier_price !== undefined) updateData.supplier_price = updates.supplier_price;
    updateData.deposit_amount = Math.round(price * rate / 100);
    updateData.remaining_amount = price - Math.round(price * rate / 100);
  }

  // Auto-status on stock transitions
  if (typeof updateData.stock === 'number' && updateData.stock === 0 && (existing.stock as number) > 0) {
    updateData.status = 'out_of_stock';
  } else if (
    typeof updateData.stock === 'number' &&
    updateData.stock > 0 &&
    existing.status === 'out_of_stock' &&
    updates.status !== 'draft' &&
    updates.status !== 'inactive'
  ) {
    updateData.status = 'active';
  }

  const { data: product, error: updateError } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la modification' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: product });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/produits/[id] — Soft delete (trash, 48h before purge)
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('products')
    .update({ deleted_at: now, status: 'inactive', updated_at: now })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la suppression' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Produit déplacé vers la corbeille (suppression dans 48h)',
  });
});

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}