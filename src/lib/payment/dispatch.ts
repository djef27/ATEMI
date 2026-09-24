/**
 * Payment dispatch — shared module for post-payment automations.
 *
 * Called AFTER confirm_deposit_payment RPC succeeds.
 * All actions are fire-and-forget: errors are logged but never block the response.
 *
 * Automations:
 *   1. Generate receipt number (unique per order)
 *   2. Send payment confirmation email to customer
 *   3. Dispatch pending WhatsApp notifications (vendors + admin)
 *
 * IDEMPOTENCE:
 *   - The RPC confirm_deposit_payment already checks payment.status = 'paid'
 *   - If called twice for the same order, receipt_number is already set (won't regenerate)
 *   - WhatsApp dispatch reads status='pending' — sent notifications are marked 'sent'
 *   - Email is best-effort with logging
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { sendEmail, paymentConfirmationEmail } from '@/lib/email';
import { dispatchPendingNotifications } from '@/lib/notifications/dispatcher';

// ---------------------------------------------------------------------------
// Receipt number generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique receipt number: ATEMI-YYYYMMDD-XXXX
 * Uses the order ID suffix for uniqueness.
 * Only generates if receipt_number is not already set (idempotent).
 */
async function generateReceiptNumber(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  orderId: string,
  orderNumber: string
): Promise<string | null> {
  // Check if receipt number already exists (idempotent)
  const { data: existing } = await supabase
    .from('orders')
    .select('receipt_number')
    .eq('id', orderId)
    .single();

  if (existing?.receipt_number) {
    return existing.receipt_number;
  }

  // Generate: ATEMI-YYYYMMDD-XXXX (XXXX = 4 last chars of order UUID)
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const suffix = orderNumber.slice(-6).toUpperCase();
  const receiptNumber = `ATEMI-${dateStr}-${suffix}`;

  // Store (idempotent — only if not already set)
  const { error } = await supabase
    .from('orders')
    .update({ receipt_number: receiptNumber, updated_at: now.toISOString() })
    .eq('id', orderId)
    .is('receipt_number', null);

  if (error) {
    console.error('[Dispatch] Failed to store receipt_number:', error.message);
    return null;
  }

  console.log(`[Dispatch] Receipt number generated: ${receiptNumber} for order ${orderNumber}`);
  return receiptNumber;
}

// ---------------------------------------------------------------------------
// Email dispatch
// ---------------------------------------------------------------------------

async function sendPaymentConfirmationEmail(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  orderId: string,
  orderNumber: string,
  receiptNumber: string | null
): Promise<void> {
  try {
    // Get order details
    const { data: order } = await supabase
      .from('orders')
      .select('customer_name, customer_email, delivery_address, tracking_token')
      .eq('id', orderId)
      .single();

    if (!order?.customer_email) {
      console.log(`[Dispatch] No customer email for order ${orderNumber} — skipping email`);
      return;
    }

    // Get order items
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_price')
      .eq('order_id', orderId);

    if (!items || items.length === 0) {
      console.log(`[Dispatch] No items for order ${orderNumber} — skipping email`);
      return;
    }

    // Get payment details
    const { data: payment } = await supabase
      .from('payments')
      .select('amount, transaction_reference')
      .eq('order_id', orderId)
      .eq('payment_type', 'deposit')
      .single();

    const emailData = paymentConfirmationEmail({
      orderNumber,
      customerName: order.customer_name?.trim() || 'Client',
      receiptNumber: receiptNumber || orderNumber,
      items: items.map(i => ({
        name: i.product_name,
        quantity: i.quantity,
        price: i.unit_price,
      })),
      depositPaid: payment?.amount || 0,
      transactionReference: payment?.transaction_reference || '',
      deliveryAddress: order.delivery_address || undefined,
      trackingToken: order.tracking_token,
    });

    const result = await sendEmail({
      to: order.customer_email,
      ...emailData,
    });

    if (result.success) {
      console.log(`[Dispatch] Payment confirmation email sent to ${order.customer_email}`);
    } else {
      console.error(`[Dispatch] Email failed for order ${orderNumber}:`, result.error);
    }
  } catch (err) {
    console.error(`[Dispatch] Email dispatch error for order ${orderNumber}:`, err);
  }
}

// ---------------------------------------------------------------------------
// WhatsApp dispatch (shared between webhook and confirm)
// ---------------------------------------------------------------------------

/**
 * Route toute la file WhatsApp par le dispatcher central UNIQUE
 * (claim atomique + retry). Jamais d'envoi direct ici : tout passe par
 * notification pending -> sending -> tentative -> sent / retry / failed.
 */
async function dispatchWhatsAppNotifications(
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<void> {
  try {
    const summary = await dispatchPendingNotifications({ supabase });
    console.info('[AUTOMATIONS_WHATSAPP_DISPATCHED]', summary);
  } catch (err) {
    console.error('[AUTOMATIONS_WHATSAPP_FAILED]', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Main dispatch function — called after confirm_deposit_payment RPC
// ---------------------------------------------------------------------------

/**
 * Dispatch all post-payment automations.
 * Called fire-and-forget after confirm_deposit_payment RPC succeeds.
 *
 * @param orderId - The order ID (UUID)
 * @param orderNumber - The order number (human-readable)
 */
export async function dispatchPaymentActions(
  orderId: string,
  orderNumber: string
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  console.info('[AUTOMATIONS_STARTED]', { orderId, orderNumber });

  // 1. Generate receipt number (idempotent)
  const receiptNumber = await generateReceiptNumber(supabase, orderId, orderNumber);

  // 2. Send payment confirmation email (best-effort)
  await sendPaymentConfirmationEmail(supabase, orderId, orderNumber, receiptNumber);

  // 3. Dispatch pending WhatsApp notifications (vendors + admin)
  await dispatchWhatsAppNotifications(supabase);
  console.info('[AUTOMATIONS_COMPLETED]', {
    orderId,
    orderNumber,
    receiptGenerated: Boolean(receiptNumber),
  });
}
