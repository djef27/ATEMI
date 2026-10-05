import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import {
  checkIdempotencyKey,
  generateRequestHash,
  storeIdempotencyResponse,
} from '@/lib/idempotency';
import { paymentInitiateSchema } from '@/lib/validations';
import { dispatchPaymentActions } from '@/lib/payment/dispatch';
import { getPaymentConfig, validateServiceRoleKey } from '@/lib/payment/config';
import { getClientIp } from '@/lib/request';
import { isOrderStatusTerminal } from '@/lib/order-status';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Route indisponible' }, { status: 404 });
  }

  try {
    if (!getPaymentConfig().isMock) {
      return NextResponse.json(
        { success: false, error: 'Le mode simulation n’est pas actif' },
        { status: 409 }
      );
    }
    validateServiceRoleKey();

    const rateLimit = await checkRateLimit(
      `ip:${getClientIp(request)}`,
      RATE_LIMIT_CONFIGS.paymentConfirm
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }
    const parsed = paymentInitiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    const { order_number, tracking_token } = parsed.data;
    const supabase = createAdminSupabaseClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .eq('order_number', order_number.trim())
      .eq('tracking_token', tracking_token)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Commande introuvable ou lien invalide' },
        { status: 404 }
      );
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, status, provider')
      .eq('order_id', order.id)
      .eq('payment_type', 'deposit')
      .single();
    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Paiement introuvable' }, { status: 404 });
    }
    if (payment.status === 'paid') {
      return NextResponse.json({ success: true, already_processed: true });
    }
    if (payment.provider !== 'mock' || isOrderStatusTerminal(order.status)) {
      return NextResponse.json(
        { success: false, error: 'Cette commande ne peut pas être simulée' },
        { status: 409 }
      );
    }

    const idempotencyKey = `pay:mock:${order.id}`;
    const idempotencyResult = await checkIdempotencyKey(
      idempotencyKey,
      {
        requesterType: 'customer',
        requesterId: order.id,
        requestMethod: 'POST',
        requestPath: '/api/payment/mock/confirm',
      },
      generateRequestHash(parsed.data)
    );
    if (idempotencyResult.error) {
      return NextResponse.json({ success: false, error: 'Erreur de vérification d’idempotence' }, { status: 500 });
    }
    if (!idempotencyResult.isNew) {
      return NextResponse.json(
        idempotencyResult.existingResponse || { success: false, error: 'Simulation déjà en cours' },
        { status: idempotencyResult.existingResponse ? 200 : 409 }
      );
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_deposit_payment', {
      p_payment_id: payment.id,
      p_transaction_reference: `MOCK-${order.order_number}`,
      p_payment_method: 'mobile_money',
    });
    if (rpcError) {
      console.error('[MOCK_PAYMENT_CONFIRMATION_FAILED]', rpcError.message);
      const response = { success: false, error: 'Impossible de confirmer la simulation' };
      await storeIdempotencyResponse(idempotencyKey, 500, response);
      return NextResponse.json(response, { status: 500 });
    }

    const response = {
      success: true,
      data: {
        already_processed: rpcData?.already_processed ?? false,
        order_id: rpcData?.order_id || order.id,
        order_number: rpcData?.order_number || order.order_number,
      },
    };
    await storeIdempotencyResponse(idempotencyKey, 200, response);
    dispatchPaymentActions(order.id, order.order_number).catch((error: unknown) => {
      console.error('[MOCK_PAYMENT_DISPATCH_FAILED]', {
        orderNumber: order.order_number,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[MOCK_PAYMENT_ERROR]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
