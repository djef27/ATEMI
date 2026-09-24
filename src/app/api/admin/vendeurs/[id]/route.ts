import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAllowedOrigin } from '@/lib/auth-helpers';
import { z } from 'zod';

const vendorUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).regex(/^\+?[0-9\s\-]*$/).nullable().optional(),
  whatsapp_number: z.string().max(20).regex(/^\+?[0-9\s\-]*$/).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(10).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/vendeurs/[id] — Get vendor details + stats
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireAdminAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;

    const { data: vendor, error: vendorError } = await auth.supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ success: false, error: 'Vendeur introuvable' }, { status: 404 });
    }

    // Fetch product count
    const { count: productCount } = await auth.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', id);

    // Fetch order count
    const { count: orderCount } = await auth.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', id);

    return NextResponse.json({
      success: true,
      data: {
        ...vendor,
        product_count: productCount || 0,
        order_count: orderCount || 0,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/vendeurs/[id] — Update vendor (status, info)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireAdminAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = vendorUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const data = parsed.data;

    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.whatsapp_number !== undefined) updateData.whatsapp_number = data.whatsapp_number;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.status !== undefined) updateData.status = data.status;

    const { data: vendor, error: updateError } = await auth.supabase
      .from('vendors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la modification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: vendor });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/vendeurs/[id] — Soft-delete vendor (set inactive)
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireAdminAuth(request);
    if ('error' in auth) return auth.error;

    const { id } = await params;

    // Check vendor exists
    const { data: vendor, error: fetchError } = await auth.supabase
      .from('vendors')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !vendor) {
      return NextResponse.json({ success: false, error: 'Vendeur introuvable' }, { status: 404 });
    }

    // Soft delete: set status to inactive (preserve data for order history)
    const { error: updateError } = await auth.supabase
      .from('vendors')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la désactivation' }, { status: 500 });
    }

    // Also set all vendor products to inactive
    await auth.supabase
      .from('products')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('vendor_id', id)
      .eq('status', 'active');

    return NextResponse.json({ success: true, message: 'Vendeur désactivé' });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}
