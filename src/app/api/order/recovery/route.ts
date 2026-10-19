import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-rate-limit';
import { orderRecoverySchema } from '@/lib/validations';
import { getClientIp } from '@/lib/request';

/**
 * POST /api/order/recovery
 *
 * Server-side recovery of a guest order by order_number + email. Replaces the
 * direct browser call to the SECURITY DEFINER RPC get_order_by_email() so that:
 *   - lookups run through the service-role admin client (server-only),
 *   - the exposure of tracking_token is rate-limited per IP,
 *   - only the fields needed by /suivi are returned.
 *
 * SECURITY CHAIN:
 *   1. Rate limiting (strict per-IP quota, Redis fail-closed in production)
 *   2. Zod payload validation (order_number + email)
 *   3. Direct table read via admin client (RLS bypass, server-only)
 *   4. Generic not-found response (no user enumeration)
 *   5. Minimal disclosure: only the fields rendered by /suivi are returned
 *      (customer_name / customer_phone are dropped compared with the legacy RPC)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMIT_CONFIGS.orderRecovery);
    const rateLimited = rateLimitResponse(rl);
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = orderRecoverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    const orderNumber = parsed.data.order_number.trim();
    const email = parsed.data.email.trim().toLowerCase();

    // Minimal disclosure: customer_name / customer_phone are never rendered by
    // /suivi, so they are neither selected nor returned.
    const { data: order, error } = await createAdminSupabaseClient()
      .from('orders')
      .select(
        'order_number, tracking_token, status, total_amount, deposit_amount, delivery_balance, delivery_city, created_at'
      )
      .eq('order_number', orderNumber)
      .eq('customer_email', email)
      .maybeSingle();

    if (error) {
      console.error('[ORDER_RECOVERY_LOOKUP_FAILED]', error.message);
      return NextResponse.json(
        { success: false, error: 'Erreur interne du serveur' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Commande non trouvée pour ce numéro et cet e-mail' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      order_number: order.order_number,
      tracking_token: order.tracking_token,
      status: order.status,
      total_amount: order.total_amount,
      deposit_amount: order.deposit_amount,
      delivery_balance: order.delivery_balance,
      currency: 'XOF',
      delivery_city: order.delivery_city,
      created_at: order.created_at,
    });
  } catch (error: unknown) {
    console.error('[ORDER_RECOVERY_ERROR]', {
      error: error instanceof Error ? error.message : String(error),
    });
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