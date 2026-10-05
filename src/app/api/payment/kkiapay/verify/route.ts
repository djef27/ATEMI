import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import {
  checkIdempotencyKey,
  generateRequestHash,
  storeIdempotencyResponse,
} from '@/lib/idempotency';
import { kkiapayVerifySchema } from '@/lib/validations';
import { dispatchPaymentActions } from '@/lib/payment/dispatch';
import { getPaymentConfig, validateServiceRoleKey } from '@/lib/payment/config';
import { getPaymentProvider } from '@/lib/payment/providers';
import { getClientIp } from '@/lib/request';
import { isOrderStatusTerminal } from '@/lib/order-status';

export async function POST(request: NextRequest) {
  try {
    validateServiceRoleKey();

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`ip:${ip}`, RATE_LIMIT_CONFIGS.paymentWebhook);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const config = getPaymentConfig();
    if (config.provider !== 'kkiapay') {
      return NextResponse.json(
        { success: false, error: 'KKiaPay n’est pas le fournisseur de paiement actif' },
        { status: 409 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = kkiapayVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    const { order_number, tracking_token, transaction_id } = parsed.data;
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
      .select('id, order_id, amount, currency, status, payment_type, provider')
      .eq('order_id', order.id)
      .eq('payment_type', 'deposit')
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Paiement introuvable' }, { status: 404 });
    }

    if (payment.status === 'paid') {
      return NextResponse.json({ success: true, already_processed: true });
    }

    if (payment.provider !== 'kkiapay') {
      return NextResponse.json(
        { success: false, error: 'Cette commande n’a pas été initialisée avec KKiaPay' },
        { status: 409 }
      );
    }

    if (isOrderStatusTerminal(order.status)) {
      return NextResponse.json(
        { success: false, error: 'Cette commande ne peut plus être payée' },
        { status: 409 }
      );
    }

    const verification = await getPaymentProvider().getPaymentStatus(transaction_id);
    if (verification.status === 'failed') {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: 'Transaction refusée par KKiaPay',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .neq('status', 'paid');
      return NextResponse.json({ success: false, error: 'Le paiement KKiaPay a échoué' }, { status: 402 });
    }

    if (verification.status !== 'succeeded') {
      return NextResponse.json(
        { success: true, pending: true, message: 'Paiement en attente de confirmation par KKiaPay' },
        { status: 202 }
      );
    }

    const { data: linkedPayment, error: linkedPaymentError } = await supabase
      .from('payments')
      .select('id')
      .eq('provider', 'kkiapay')
      .eq('provider_transaction_id', transaction_id)
      .maybeSingle();
    if (linkedPaymentError) {
      console.error('[KKIAPAY_TRANSACTION_LOOKUP_FAILED]', linkedPaymentError.message);
      return NextResponse.json({ success: false, error: 'Impossible de vérifier cette transaction' }, { status: 500 });
    }
    if (linkedPayment && linkedPayment.id !== payment.id) {
      return NextResponse.json(
        { success: false, error: 'Cette transaction est déjà liée à une autre commande' },
        { status: 409 }
      );
    }

    const { error: transactionError } = await supabase
      .from('payments')
      .update({
        provider_transaction_id: transaction_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);
    if (transactionError) {
      console.error('[KKIAPAY_TRANSACTION_SAVE_FAILED]', transactionError.message);
      if (transactionError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Cette transaction est déjà liée à une autre commande' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Impossible d’enregistrer la transaction vérifiée' },
        { status: 500 }
      );
    }

    if (verification.amount !== payment.amount || payment.currency !== 'XOF') {
      console.error('[KKIAPAY_AMOUNT_MISMATCH]', {
        orderNumber: order.order_number,
        expectedAmount: payment.amount,
        verifiedAmount: verification.amount,
        currency: payment.currency,
      });
      return NextResponse.json(
        { success: false, error: 'Le montant vérifié ne correspond pas à la commande' },
        { status: 400 }
      );
    }

    const idempotencyKey = `pay:kkiapay:${transaction_id}`;
    const idempotencyResult = await checkIdempotencyKey(
      idempotencyKey,
      {
        requesterType: 'customer',
        requesterId: order.id,
        requestMethod: 'POST',
        requestPath: '/api/payment/kkiapay/verify',
      },
      generateRequestHash(parsed.data)
    );

    if (idempotencyResult.error === 'IDEMPOTENCY_KEY_CONFLICT') {
      return NextResponse.json(
        { success: false, error: 'Cette transaction est déjà associée à une autre demande' },
        { status: 409 }
      );
    }
    if (idempotencyResult.error) {
      console.error('[KKIAPAY_IDEMPOTENCY_CHECK_FAILED]', idempotencyResult.error);
      return NextResponse.json({ success: false, error: 'Vérification de paiement impossible' }, { status: 500 });
    }
    if (!idempotencyResult.isNew) {
      if (idempotencyResult.existingResponse) {
        return NextResponse.json(idempotencyResult.existingResponse);
      }
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_deposit_payment', {
      p_payment_id: payment.id,
      p_transaction_reference: transaction_id,
      p_payment_method: 'mobile_money',
    });

    if (rpcError) {
      console.error('[KKIAPAY_CONFIRMATION_FAILED]', {
        orderNumber: order.order_number,
        transactionId: transaction_id,
        error: rpcError.message,
      });
      const response = { success: false, error: 'Erreur lors de la confirmation du paiement' };
      return NextResponse.json(response, { status: 500 });
    }

    const response = {
      success: true,
      data: {
        already_processed: rpcData?.already_processed ?? false,
        order_id: rpcData?.order_id || order.id,
        order_number: rpcData?.order_number || order.order_number,
        payment_status: rpcData?.payment_status,
        order_status: rpcData?.order_status,
      },
    };
    await storeIdempotencyResponse(idempotencyKey, 200, response);

    dispatchPaymentActions(order.id, order.order_number).catch((error: unknown) => {
      console.error('[KKIAPAY_POST_PAYMENT_DISPATCH_FAILED]', {
        orderNumber: order.order_number,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[KKIAPAY_VERIFY_ERROR]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
