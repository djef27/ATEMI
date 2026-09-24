import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminAuth } from '@/lib/auth-helpers';
import { slugify } from '@/lib/utils';

const categoryUpdateSchema = z.object({
  name: z.string().min(1, 'nom requis').max(100, 'nom trop long').optional(),
  description: z.string().max(1000, 'description trop longue').nullable().optional(),
  image_url: z.string().url('URL invalide').max(500, 'URL trop longue').nullable().optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/categories/[id] — Update category info / toggle active
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
  }

  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: 'Catégorie introuvable' }, { status: 404 });
  }

  const updates = parsed.data;
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.name !== undefined && updates.name !== existing.name) {
    const newSlug = slugify(updates.name);
    const { data: slugConflict } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', newSlug)
      .neq('id', id)
      .limit(1);

    if (slugConflict && slugConflict.length > 0) {
      return NextResponse.json({ success: false, error: 'Une catégorie avec ce nom existe déjà' }, { status: 409 });
    }
    updateData.name = updates.name;
    updateData.slug = newSlug;
  }

  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data: category, error: updateError } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la modification' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: category });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/categories/[id] — Deactivate category
// (blocked while active products reference it)
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from('categories')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, error: 'Catégorie introuvable' }, { status: 404 });
  }

  const { data: usedBy, error: countError } = await supabase
    .from('products')
    .select('id')
    .eq('category_id', id)
    .is('deleted_at', null)
    .limit(1);

  if (countError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la vérification' }, { status: 500 });
  }

  if (usedBy && usedBy.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Catégorie utilisée par des produits actifs, impossible de la supprimer' },
      { status: 409 }
    );
  }

  // Soft delete: deactivate (products/categories keep their history)
  const { error: updateError } = await supabase
    .from('categories')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Erreur lors de la suppression' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Catégorie désactivée' });
});

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}