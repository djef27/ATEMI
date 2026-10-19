import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireVendorAuth, isAllowedOrigin } from '@/lib/auth-helpers';
import { VENDOR_UPDATEABLE_STATUSES, isOrderStatusTerminal } from '@/lib/order-status';
import type { OrderStatus } from '@/types';

const vendorStatusSchema = z.object({
  status: z
    .string()
    .refine((s): s is OrderStatus => (VENDOR_UPDATEABLE_STATUSES as string[]).includes(s), {
      message: 'statut de commande invalide',
    }),
  note: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/vendor/orders/[id] — Vendor updates order status
// Vendor may only move an order to vendor_processing or ready_for_delivery,
// and never on a pending/unpaid or terminal order.
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = vendorStatusSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const { status: newStatus, note } = parsed.data;

    const { data: order, error: fetchError } = await auth.supabase
      .from('orders')
      .select('id, order_number, status, vendor_id')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Commande introuvable' }, { status: 404 });
    }

    if (!auth.isAdmin && !auth.vendorId) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
    }

    // Mirrors the "orders_vendor_read" RLS predicate: a vendor may act on an
    // order either when it is single-vendor (orders.vendor_id) or when at least
    // one order_items row belongs to them. orders.vendor_id is NULL for
    // multi-vendor baskets, so testing it alone would wrongly reject a
    // legitimate vendor. The RPC runs through the service-role client (which is
    // granted EXECUTE) and therefore never bypasses the ownership rule.
    if (!auth.isAdmin) {
      const { data: ownsItems, error: ownershipError } = await auth.supabase.rpc(
        'order_has_vendor_items',
        { p_order_id: id, p_vendor_id: auth.vendorId }
      );
      if (ownershipError || ownsItems !== true) {
        return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
      }
    }

    const oldStatus = order.status as OrderStatus;
    if (oldStatus === newStatus) {
      return NextResponse.json({ success: false, error: 'La commande a déjà ce statut' }, { status: 409 });
    }

    if (oldStatus === 'pending_payment') {
      return NextResponse.json(
        { success: false, error: 'Le vendeur ne peut pas modifier une commande non payée' },
        { status: 409 }
      );
    }

    if (isOrderStatusTerminal(oldStatus)) {
      return NextResponse.json(
        { success: false, error: 'Impossible de modifier une commande au statut terminal' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await auth.supabase
      .from('orders')
      .update({ status: newStatus, updated_at: now })
      .eq('id', id)
      .eq('status', oldStatus)
      .select('id, order_number, status, updated_at')
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, error: "Commande modifiée pendant l'opération, réessayez" },
        { status: 409 }
      );
    }

    await auth.supabase.from('order_status_history').insert({
      order_id: id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: null,
      note: note ?? null,
    });

    console.info('[VENDOR_ORDER_STATUS]', {
      orderId: id,
      orderNumber: order.order_number,
      oldStatus,
      newStatus,
      vendorId: auth.vendorId,
      isAdmin: auth.isAdmin,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}