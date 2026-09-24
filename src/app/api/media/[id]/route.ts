import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAuth, requireMediaOwner, isAllowedOrigin } from '@/lib/auth-helpers';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// PATCH /api/media/[id] — Update image metadata (is_primary, alt_text, sort_order)
// ---------------------------------------------------------------------------

const mediaUpdateSchema = z.object({
  is_primary: z.boolean().optional(),
  alt_text: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
});

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
    const mediaCheck = await requireMediaOwner(auth.supabase, id, auth.vendorId, auth.isAdmin);
    if ('error' in mediaCheck) return mediaCheck.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = mediaUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.is_primary !== undefined) updateData.is_primary = parsed.data.is_primary;
    if (parsed.data.alt_text !== undefined) updateData.alt_text = parsed.data.alt_text;
    if (parsed.data.sort_order !== undefined) updateData.sort_order = parsed.data.sort_order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune donnée à modifier' }, { status: 400 });
    }

    // If setting as primary, unset others first
    if (updateData.is_primary === true) {
      const { data: image } = await auth.supabase
        .from('product_images')
        .select('product_id')
        .eq('id', id)
        .single();

      if (image) {
        await auth.supabase
          .from('product_images')
          .update({ is_primary: false })
          .eq('product_id', image.product_id)
          .neq('id', id);
      }
    }

    const { error: updateError } = await auth.supabase
      .from('product_images')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la modification' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/media/[id] — Delete an image
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
    const mediaCheck = await requireMediaOwner(auth.supabase, id, auth.vendorId, auth.isAdmin);
    if ('error' in mediaCheck) return mediaCheck.error;

    const { error: deleteError } = await auth.supabase
      .from('product_images')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la suppression' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// Reject GET and PUT
export async function GET() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}
