import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { paymentConfirmSchema } from '@/lib/validations';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { checkIdempotencyKey, storeIdempotencyResponse, generateRequestHash, getIdempotencyKey, IdempotencyContext } from '@/lib/idempotency';
import { validateServiceRoleKey } from '@/lib/payment/config';
import { dispatchPaymentActions } from '@/lib/payment/dispatch';
import { isAllowedOrigin } from '@/lib/auth-helpers';

/**
 * POST /api/payment/confirm
 *
 * Confirms a deposit payment. Admin-only endpoint.
 *
 * Security chain:
 *   1. Method check (POST only)
 *   2. CSRF / Origin check
 *   3. Rate limiting (per-user, Upstash-ready, fail-closed in production)
 *   4. Authentication (session)
 *   5. Authorization (admin role)
 *   6. Input validation (Zod)
 *   6b. Idempotency check (persistent DB)
 *   7. Server-side amount verification (DB is source of truth)
 *   8. Server-side RPC (confirm_deposit_payment)
 *   9. Idempotency response storage
 *   10. Error sanitization (no SQL leaks)
 */

export async function POST(request: NextRequest) {
  let idempotencyKey: string | null = null;
  let requestHash = '';

  try {
    // ------------------------------------------------------------------
    // 1. HTTP method guard
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 1b. Validate service role key (fail-fast in production)
    // ------------------------------------------------------------------

    validateServiceRoleKey();

    // ------------------------------------------------------------------
    // 2. Origin / CSRF check
    // ------------------------------------------------------------------

    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        { success: false, error: 'Origine non autorisée' },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------------
    // 3. Parse + validate body
    // ------------------------------------------------------------------

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body invalide' },
        { status: 400 }
      );
    }

    const parsed = paymentConfirmSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { payment_id, transaction_reference, payment_method } = parsed.data;

    // ------------------------------------------------------------------
    // 4. Authentication
    // ------------------------------------------------------------------

    const authSupabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    // ------------------------------------------------------------------
    // 5. Authorization (admin role)
    // ------------------------------------------------------------------

    const { data: profile, error: profileError } = await authSupabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------------
    // 6. Rate limiting (per admin user)
    // ------------------------------------------------------------------

    const rl = await checkRateLimit(user.id, RATE_LIMIT_CONFIGS.paymentConfirm);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Trop de requêtes. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)}s`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_CONFIGS.paymentConfirm.max),
            'X-RateLimit-Remaining': String(rl.remaining),
          },
        }
      );
    }

    // ------------------------------------------------------------------
    // 6b. Idempotency check (persistent DB)
    // ------------------------------------------------------------------

    idempotencyKey = getIdempotencyKey(request, 'pay:confirm', body);
    requestHash = generateRequestHash(body);

    const idempotencyContext: IdempotencyContext = {
      requesterType: 'admin',
      requesterId: user.id,
      requestMethod: 'POST',
      requestPath: '/api/payment/confirm',
    };

    const idempotencyResult = await checkIdempotencyKey(idempotencyKey, idempotencyContext, requestHash);

    if (idempotencyResult.error === 'IDEMPOTENCY_KEY_CONFLICT') {
      return NextResponse.json(
        { success: false, error: 'Clé d\'idempotence réutilisée avec un payload différent' },
        { status: 409 }
      );
    }

    if (idempotencyResult.error) {
      return NextResponse.json(
        { success: false, error: 'Erreur de vérification d\'idempotence' },
        { status: 500 }
      );
    }

    if (!idempotencyResult.isNew && idempotencyResult.existingResponse) {
      // Return cached response for idempotent replay
      return NextResponse.json(idempotencyResult.existingResponse);
    }

    // ------------------------------------------------------------------
    // 7. Server-side amount verification (DB is source of truth)
    // ------------------------------------------------------------------

    const supabase = createAdminSupabaseClient();

    // Verify payment exists and get expected amount from DB
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, order_id, payment_type, amount, currency, status')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      const response = { success: false, error: 'Paiement introuvable' };
      await storeIdempotencyResponse(idempotencyKey!, 404, response);
      return NextResponse.json(response, { status: 404 });
    }

    // Verify payment type
    if (payment.payment_type !== 'deposit') {
      const response = { success: false, error: 'Ce paiement n\'est pas un acompte' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // Verify payment is still pending (idempotency at DB level also handles this)
    if (payment.status === 'paid') {
      const response = { success: true, already_processed: true, message: 'Paiement déjà confirmé' };
      await storeIdempotencyResponse(idempotencyKey!, 200, response);
      return NextResponse.json(response);
    }

    // Verify order exists and get financial details from DB
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, deposit_amount, total_amount, delivery_balance')
      .eq('id', payment.order_id)
      .single();

    if (orderError || !order) {
      const response = { success: false, error: 'Commande introuvable' };
      await storeIdempotencyResponse(idempotencyKey!, 404, response);
      return NextResponse.json(response, { status: 404 });
    }

    // CRITICAL: Verify amount matches what the server calculated
    if (payment.amount !== order.deposit_amount) {
      const response = { success: false, error: 'Montant de paiement incohérent' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // Verify currency
    if (payment.currency !== 'XOF') {
      const response = { success: false, error: 'Devise non supportée' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // Verify order is in correct state
    if (order.status !== 'pending_payment') {
      const response = { success: false, error: `Commande dans un état invalide: ${order.status}` };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // ------------------------------------------------------------------
    // 8. Call server-side RPC (all financial logic lives in PostgreSQL)
    // ------------------------------------------------------------------

    const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_deposit_payment', {
      p_payment_id: payment_id,
      p_transaction_reference: transaction_reference?.trim() || null,
      p_payment_method: payment_method || null,
    });

    if (rpcError) {
      // Never expose SQL error messages to client
      const response = { success: false, error: 'Erreur lors de la confirmation du paiement' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // ------------------------------------------------------------------
    // 9. Store idempotency response
    // ------------------------------------------------------------------

    const successResponse = {
      success: true,
      data: {
        already_processed: rpcData?.already_processed ?? false,
        order_id: rpcData?.order_id,
        order_number: rpcData?.order_number,
        payment_status: rpcData?.payment_status,
        order_status: rpcData?.order_status,
      },
    };

    await storeIdempotencyResponse(idempotencyKey!, 200, successResponse);

    // ------------------------------------------------------------------
    // 10. Dispatch all post-payment automations (fire-and-forget)
    // ------------------------------------------------------------------

    const orderId = rpcData?.order_id || payment.order_id;
    const orderNumber = rpcData?.order_number || order.order_number;

    dispatchPaymentActions(orderId, orderNumber).catch(() => {
      // Dispatch errors are logged inside dispatchPaymentActions — never block the response
    });

    // ------------------------------------------------------------------
    // 11. Return result (only safe data)
    // ------------------------------------------------------------------

    return NextResponse.json(successResponse);
  } catch {
    // Store error response for idempotency
    if (idempotencyKey) {
      const errorResponse = { success: false, error: 'Erreur interne du serveur' };
      await storeIdempotencyResponse(idempotencyKey, 500, errorResponse);
    }

    // Never expose internals
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// Reject non-POST methods explicitly
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}