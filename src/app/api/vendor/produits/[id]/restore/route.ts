import { NextRequest, NextResponse } from 'next/server';
import {
  requireVendorAuth,
  requireProductOwner,
  isAllowedOrigin,
} from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// POST /api/vendor/produits/[id]/restore — Restore a trashed product
// ---------------------------------------------------------------------------

export async function POST(
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
    const product = productCheck.product;

    // Only allow restore if product is in trash (deleted_at is set and within 48h)
    if (!product.deleted_at) {
      return NextResponse.json({ success: false, error: 'Ce produit n\'est pas dans la corbeille' }, { status: 400 });
    }

    const deletedAt = new Date(product.deleted_at as string);
    const now = new Date();
    const hoursSinceDelete = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceDelete > 48) {
      return NextResponse.json({ success: false, error: 'Le délai de 48h est expiré, ce produit ne peut plus être restauré' }, { status: 400 });
    }

    // Restore: clear deleted_at, set status back to active
    const { error: updateError } = await auth.supabase
      .from('products')
      .update({
        deleted_at: null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la restauration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Produit restauré' });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
