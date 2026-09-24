import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminAuth } from '@/lib/auth-helpers';
import { sendEmail, orderStatusEmail } from '@/lib/email';
import {
  ADMIN_UPDATEABLE_STATUSES,
  isOrderStatusTerminal,
} from '@/lib/order-status';
import type { OrderStatus } from '@/types';

const orderStatusSchema = z.object({
  status: z
    .string()
    .refine((s): s is OrderStatus => (ADMIN_UPDATEABLE_STATUSES as string[]).includes(s), {
      message: 'statut de commande invalide',
    }),
  note: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/orders/[id] — Order detail (items, payments, status history)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (request, { supabase, params }) => {
  const { id } = await params;
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ success: false, error: 'Commande introuvable' }, { status: 404 });
  }

  const [items, payments, history, zone] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id),
    supabase.from('payments').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('delivery_zones')
      .select('name')
      .eq('id', order.delivery_zone_id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      ...order,
      items: items.data || [],
      payments: payments.data || [],
      status_history: history.data || [],
      delivery_zone_name: zone.data?.name ?? null,
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/orders/[id] — Update order status
// (history log + stock restore on cancel + best-effort email)
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (request, { supabase, userId, params }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
  }

  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { status: newStatus, note } = parsed.data;

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number, status, tracking_token, customer_email, customer_name')
    .eq('id', id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ success: false, error: 'Commande introuvable' }, { status: 404 });
  }

  const oldStatus = order.status as OrderStatus;
  if (oldStatus === newStatus) {
    return NextResponse.json(
      { success: false, error: 'La commande a déjà ce statut' },
      { status: 409 }
    );
  }

  if (isOrderStatusTerminal(oldStatus) && newStatus !== 'cancelled') {
    return NextResponse.json(
      { success: false, error: 'Impossible de modifier une commande au statut terminal' },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // Optimistic lock: only applies if status unchanged since fetch
  const { data: updated, error: updateError } = await supabase
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

  // Status history (best-effort, never blocks the response)
  const historyInsert = supabase.from('order_status_history').insert({
    order_id: id,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: userId,
    note: note ?? null,
  });

  // Restore product stock when an order is cancelled
  // (stock was decremented atomically inside create_order)
  let stockRestored = false;
  if (newStatus === 'cancelled') {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', id);

    if (items && items.length > 0) {
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
        if (!product) continue;
        const restored = product.stock + item.quantity;
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: restored, updated_at: now })
          .eq('id', item.product_id)
          .eq('stock', product.stock);
        if (!stockError) stockRestored = true;
      }
    }
  }

  await historyInsert;
  console.info('[ADMIN_ORDER_STATUS]', {
    orderId: id,
    orderNumber: order.order_number,
    oldStatus,
    newStatus,
    changedBy: userId,
    stockRestored,
  });

  // Best-effort customer email on status change
  if (order.customer_email) {
    try {
      await sendEmail({
        to: order.customer_email,
        ...orderStatusEmail({
          orderNumber: order.order_number,
          customerName: order.customer_name?.trim() || 'Client',
          status: newStatus,
          trackingToken: order.tracking_token,
        }),
      });
    } catch (err) {
      console.error('[ADMIN_ORDER_STATUS][EMAIL]', err);
    }
  }

  return NextResponse.json({
    success: true,
    data: updated,
    stockRestored,
  });
});

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
}