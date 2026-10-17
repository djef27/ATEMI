import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { checkIdempotencyKey, storeIdempotencyResponse, generateRequestHash, getIdempotencyKey, IdempotencyContext } from '@/lib/idempotency';
import { PROVIDER_EVENT_MAP, type PaymentProvider } from '@/lib/payment/types';
import { getPaymentProvider } from '@/lib/payment/providers';
import { getPaymentConfig, validateServiceRoleKey } from '@/lib/payment/config';
import { dispatchPaymentActions } from '@/lib/payment/dispatch';
import { getClientIp } from '@/lib/request';
import {
  parseEvent,
  extractTransactionId,
  extractAmountCurrency,
  extractPaymentMethod,
  shouldDeferConfirmation,
} from '@/lib/payment/webhook-events';

/**
 * POST /api/payment/webhook
 *
 * Receives payment provider webhook events.
 * Uses the provider abstraction layer for signature verification and parsing.
 *
 * SECURITY CHAIN:
 *   1. Rate limiting (IP-based, generous for provider retries)
 *   2. Provider config check (reject mock/no-secret)
 *   3. Signature verification (via provider adapter)
 *   4. Event parsing (via provider adapter)
 *   5. Idempotency check (persistent DB)
 *   6. Event type mapping (PROVIDER_EVENT_MAP)
 *   7. Server-side payment retrieval (DB is truth)
 *   8. Amount + currency verification
 *   9. Order state verification
 *   10. Atomic SQL state change (confirm_deposit_payment RPC)
 *   11. Idempotency response storage
 *
 * CINETPAY NOTE: CinetPay notifications are not signed and only carry the
 * declared outcome (cpm_result). Their status is NEVER trusted: the action is
 * computed exclusively from the provider payment-check API (source of truth).
 * A forged 'payment.failed' event cannot therefore downgrade a payment whose
 * server-side status is 'succeeded'. Refund transitions require a
 * provider-verified API result and are refused otherwise.
 *
 * PROVIDER CONFIGURATION REQUIRED:
 *   - Set PAYMENT_WEBHOOK_SECRET in .env.local
 *   - Set PAYMENT_PROVIDER (e.g., 'fedapay')
 */

export async function POST(request: NextRequest) {
  let idempotencyKey: string | null = null;

  try {
    console.info('[WEBHOOK_RECEIVED]', {
      method: request.method,
      contentType: request.headers.get('content-type'),
    });
    // ------------------------------------------------------------------
    // 0. Validate service role key (fail-fast in production)
    // ------------------------------------------------------------------

    validateServiceRoleKey();

    // ------------------------------------------------------------------
    // 1. Rate limiting (generous for provider retries)
    // ------------------------------------------------------------------

    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, RATE_LIMIT_CONFIGS.paymentWebhook);

    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
          },
        }
      );
    }

    // ------------------------------------------------------------------
    // 2. Read raw body for signature verification
    // ------------------------------------------------------------------

    const body = await request.text();

    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Body vide' },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 3. Provider configuration check
    // ------------------------------------------------------------------

    const config = getPaymentConfig();

    if (config.provider === 'kkiapay') {
      return NextResponse.json(
        { success: false, error: 'KKiaPay se confirme via /api/payment/kkiapay/verify' },
        { status: 501 }
      );
    }

    if (config.isMock || (config.provider !== 'cinetpay' && !config.webhookSecret)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook non configuré — fournisseur de paiement requis (PAYMENT_PROVIDER + PAYMENT_WEBHOOK_SECRET)',
        },
        { status: 501 }
      );
    }

    // ------------------------------------------------------------------
    // 4. Get provider and verify signature
    // ------------------------------------------------------------------

    const provider = getPaymentProvider();

    // Extract signature from provider-specific headers
    const signature = request.headers.get('x-fedapay-signature') ||
                      request.headers.get('stripe-signature') ||
                      request.headers.get('x-paystack-signature') ||
                      request.headers.get('x-webhook-signature');

    const verification = await provider.verifyWebhook(body, signature, null);

    if (!verification.valid) {
      console.warn('[WEBHOOK_SIGNATURE_INVALID]', {
        provider: config.provider,
        reason: verification.error || 'Signature invalide',
      });
      return NextResponse.json(
        { success: false, error: verification.error || 'Signature invalide' },
        { status: 401 }
      );
    }
    console.info('[WEBHOOK_SIGNATURE_VALID]', { provider: config.provider });

    // ------------------------------------------------------------------
    // 5. Parse event (provider-specific shape)
    // ------------------------------------------------------------------

    const parsed = parseEvent(body, config.provider);

    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Événement malformé' },
        { status: 400 }
      );
    }

    const { id: eventId, type: eventType, data: eventData } = parsed;
    console.info('[WEBHOOK_EVENT_PARSED]', {
      eventId,
      eventType,
      provider: config.provider,
    });

    // ------------------------------------------------------------------
    // 6. Idempotency check (persistent DB)
    // Use event ID for proper per-event idempotency, not URL-based key
    // ------------------------------------------------------------------

    idempotencyKey = eventId ? `pay:evt:${eventId}` : getIdempotencyKey(request, 'pay:webhook', body);
    const requestHash = generateRequestHash(body);

    const idempotencyContext: IdempotencyContext = {
      requesterType: 'webhook',
      requesterId: config.provider,
      requestMethod: 'POST',
      requestPath: '/api/payment/webhook',
    };

    const idempotencyResult = await checkIdempotencyKey(idempotencyKey, idempotencyContext, requestHash);

    if (idempotencyResult.error === 'IDEMPOTENCY_KEY_CONFLICT') {
      return NextResponse.json(
        { success: false, error: 'Clé d\'idempotence réutilisée avec un payload différent' },
        { status: 409 }
      );
    }

    if (!idempotencyResult.isNew && idempotencyResult.existingResponse) {
      return NextResponse.json(idempotencyResult.existingResponse);
    }

    // ------------------------------------------------------------------
    // 7. Map provider event type to internal action
    // ------------------------------------------------------------------

    let action: string | null = PROVIDER_EVENT_MAP[eventType];
    if (!action) {
      const response = { success: true, message: `Événement non géré: ${eventType}` };
      await storeIdempotencyResponse(idempotencyKey!, 200, response);
      return NextResponse.json(response);
    }

    // ------------------------------------------------------------------
    // 8. Extract provider transaction ID
    // ------------------------------------------------------------------

    const providerTransactionId = extractTransactionId(eventData, config.provider);
    console.info('[WEBHOOK_TRANSACTION_FOUND]', {
      eventId,
      transactionReference: providerTransactionId,
    });

    if (!providerTransactionId) {
      const response = { success: false, error: 'ID de transaction manquant dans l\'événement' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // ------------------------------------------------------------------
    // 9. Retrieve payment from DB (server-side truth)
    // ------------------------------------------------------------------

    const supabase = createAdminSupabaseClient();

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, order_id, payment_type, amount, currency, status, transaction_reference')
      .eq('transaction_reference', providerTransactionId)
      .single();

    if (paymentError || !payment) {
      const response = { success: false, error: 'Paiement introuvable pour cette référence' };
      await storeIdempotencyResponse(idempotencyKey!, 404, response);
      return NextResponse.json(response, { status: 404 });
    }

    // CinetPay notifications are only hints. Always query the provider API
    // and use its response as the source of truth for status and amount.
    const providerConfirmation = config.provider === 'cinetpay'
      ? await provider.getPaymentStatus(providerTransactionId)
      : null;

    // The event's declared outcome is NOT trusted for CinetPay (unsigned
    // notification): the action is derived only from the provider API.
    // For other providers (signature-verified, e.g. FedaPay) the event map
    // stands. Refund transitions are additionally refused further down.
    if (config.provider === 'cinetpay') {
      if (providerConfirmation?.status === 'succeeded') {
        action = 'payment_confirmed';
      } else if (providerConfirmation?.status === 'failed') {
        action = 'payment_failed';
      } else {
        action = null;
      }
    }

    await supabase
      .from('payments')
      .update({
        provider_transaction_id: providerTransactionId,
        webhook_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);
    console.info('[PAYMENT_STATUS]', {
      paymentId: payment.id,
      status: payment.status,
      providerTransactionId,
    });

    // ------------------------------------------------------------------
    // 10. Verify amount + currency from provider event
    // ------------------------------------------------------------------

    const { amount: eventAmount, currency: eventCurrency } = extractAmountCurrency(eventData, config.provider);
    const providerAmount = providerConfirmation?.amount ?? eventAmount;
    const providerCurrency = providerConfirmation?.currency ?? eventCurrency;

    if (providerAmount === null) {
      const response = { success: false, error: 'Montant manquant dans l\'événement du fournisseur' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    if (providerConfirmation?.status === 'failed') {
      if (payment.status === 'pending') {
        await supabase.from('payments').update({
          status: 'failed',
          failure_reason: 'Transaction refusée par le fournisseur',
          updated_at: new Date().toISOString(),
        }).eq('id', payment.id);
      }
      const response = { success: true, message: 'Paiement CinetPay refusé' };
      await storeIdempotencyResponse(idempotencyKey!, 200, response);
      return NextResponse.json(response);
    }

    if (shouldDeferConfirmation(providerConfirmation)) {
      const response = { success: true, message: 'Paiement CinetPay en attente' };
      await storeIdempotencyResponse(idempotencyKey!, 200, response);
      return NextResponse.json(response);
    }

    if (providerAmount !== payment.amount) {
      const response = { success: false, error: 'Montant divergent entre fournisseur et système' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    if (providerCurrency && providerCurrency !== payment.currency) {
      const response = { success: false, error: 'Devise divergente entre fournisseur et système' };
      await storeIdempotencyResponse(idempotencyKey!, 400, response);
      return NextResponse.json(response, { status: 400 });
    }

    // ------------------------------------------------------------------
    // 11. Verify order exists and is in correct state
    // ------------------------------------------------------------------

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
    console.info('[ORDER_FOUND]', {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
    });

    // ------------------------------------------------------------------
    // 12. Apply state change in atomic SQL transaction
    // ------------------------------------------------------------------

    let response: { success: boolean; message?: string; error?: string; already_processed?: boolean; data?: { already_processed: boolean; order_id?: string; order_number?: string; payment_status?: string; order_status?: string } };

    if (action === 'payment_confirmed') {
      if (payment.status === 'paid') {
        response = { success: true, already_processed: true, message: 'Paiement déjà confirmé' };
      } else {
        const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_deposit_payment', {
          p_payment_id: payment.id,
          p_transaction_reference: providerTransactionId,
          p_payment_method: extractPaymentMethod(eventData, config.provider),
        });

        if (rpcError) {
          console.error('[WEBHOOK_CONFIRMATION_FAILED]', {
            paymentId: payment.id,
            orderId: order.id,
            transactionReference: providerTransactionId,
            error: rpcError.message,
          });
          response = { success: false, error: 'Erreur lors de la confirmation du paiement' };
        } else {
          await supabase
            .from('payments')
            .update({
              provider_transaction_id: providerTransactionId,
              verified_at: new Date().toISOString(),
              failure_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id);
          response = {
            success: true,
            data: {
              already_processed: rpcData?.already_processed ?? false,
              order_id: rpcData?.order_id,
              order_number: rpcData?.order_number,
              payment_status: rpcData?.payment_status,
              order_status: rpcData?.order_status,
            },
          };

          console.info('[PAYMENT_CONFIRMED]', {
            orderId: order.id,
            orderNumber: order.order_number,
            transactionReference: providerTransactionId,
          });
          console.info('[ORDER_UPDATED_PAID]', {
            orderId: order.id,
            orderNumber: order.order_number,
            status: rpcData?.order_status,
          });

          // Dispatch all post-payment automations (fire-and-forget)
          console.info('[POST_PAYMENT_AUTOMATIONS_STARTED]', {
            orderId: order.id,
            orderNumber: order.order_number,
          });
          dispatchPaymentActions(order.id, order.order_number).catch((error: unknown) => {
            console.error('[POST_PAYMENT_AUTOMATIONS_FAILED]', {
              orderId: order.id,
              orderNumber: order.order_number,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      }
    } else if (action === 'payment_failed') {
      if (payment.status === 'pending') {
        await supabase
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', payment.id);
      }
      response = { success: true, message: 'Paiement marqué comme échoué' };
    } else if (action === 'payment_refunded') {
      // A refund transition must never be triggered by a mere notification.
      // It requires a provider-verified API result, which none of the current
      // adapters expose. Refuse the transition and require manual reconciliation.
      response = {
        success: false,
        error: 'Remboursement refusé — transition non confirmée par le prestataire, traitement manuel requis',
      };
    } else {
      response = { success: true, message: `Action ${action} reçue` };
    }

    // ------------------------------------------------------------------
    // 13. Store idempotency response
    // ------------------------------------------------------------------

    const statusCode = response.success ? 200 : 400;
    await storeIdempotencyResponse(idempotencyKey!, statusCode, response);

    // ------------------------------------------------------------------
    // 14. Respond to provider
    // ------------------------------------------------------------------

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[WEBHOOK_ERROR]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Provider-specific helpers — moved to src/lib/payment/webhook-events.ts
// ---------------------------------------------------------------------------

// Reject non-POST methods
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Méthode non autorisée' },
    { status: 405 }
  );
}
