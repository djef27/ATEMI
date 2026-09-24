import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { paymentInitiateSchema } from '@/lib/validations';
import { getPaymentConfig } from '@/lib/payment/config';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { createCinetPayPayment } from '@/lib/payment/providers/cinetpay';
import { getPaymentMethods } from '@/lib/payment/countries';

/**
 * POST /api/payment/initiate
 *
 * Client/guest-facing endpoint. Verifies order via order_number + tracking_token
 * (same pattern as get_order_tracking / get_order_receipt), then creates a real
 * payment transaction on the configured provider (CinetPay / FedaPay) and
 * returns its hosted payment_url for redirect.
 *
 * Reuses an existing payment_url if one was already created (idempotent, avoids
 * stacking provider transactions on page reload).
 */

function getFedaPayBaseUrl(apiSecret: string): string {
  return apiSecret.startsWith('sk_live_')
    ? 'https://api.fedapay.com'
    : 'https://sandbox-api.fedapay.com';
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMIT_CONFIGS.paymentInitiate);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
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
      return NextResponse.json({ success: false, error: 'Requete invalide' }, { status: 400 });
    }

    const { order_number, tracking_token, country, payment_method } = parsed.data;
    if (country && payment_method) {
      const countryConfig = getPaymentMethods(country);
      const methodIsEnabled = countryConfig?.paymentMethods.some(
        (method) => method.id === payment_method
      );
      if (!methodIsEnabled) {
        return NextResponse.json(
          { success: false, error: 'Moyen de paiement non disponible pour ce pays' },
          { status: 400 }
        );
      }
    }
    const supabase = createAdminSupabaseClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, customer_email, status')
      .eq('order_number', order_number.trim())
      .eq('tracking_token', tracking_token)
      .single();

    if (orderError && orderError.code !== 'PGRST116') {
      console.error('[PAYMENT_INITIATE] order query error:', orderError.code, orderError.message);
      return NextResponse.json({ success: false, error: 'Erreur lors de la recuperation de la commande' }, { status: 500 });
    }
    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Commande introuvable ou lien invalide' }, { status: 404 });
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, amount, status, payment_url, transaction_reference')
      .eq('order_id', order.id)
      .eq('payment_type', 'deposit')
      .single();

    if (paymentError && paymentError.code !== 'PGRST116') {
      console.error('[PAYMENT_INITIATE] payment query error:', paymentError.code, paymentError.message);
      return NextResponse.json({ success: false, error: 'Erreur lors de la recuperation du paiement' }, { status: 500 });
    }
    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Paiement introuvable' }, { status: 404 });
    }

    if (payment.status === 'paid') {
      return NextResponse.json({ success: true, already_paid: true });
    }

    // If transaction_reference exists but payment_url is missing, the DB update
    // failed after FedaPay transaction creation. Also detect failed provider
    // transactions so a retry gets a fresh payment session.
    if (payment.transaction_reference) {
      const config = getPaymentConfig();
      if (config.provider === 'fedapay') {
        const baseUrl = getFedaPayBaseUrl(config.apiSecret);
        try {
          const checkResponse = await fetch(
            `${baseUrl}/v1/transactions/${payment.transaction_reference}`,
            { headers: { Authorization: `Bearer ${config.apiSecret}` } }
          );
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            const tx = checkData['v1/transaction'];
            const providerStatus = String(tx?.status || '').toLowerCase();
            if (['declined', 'canceled', 'cancelled', 'failed'].includes(providerStatus)) {
              await supabase
                .from('payments')
                .update({
                  payment_url: null,
                  transaction_reference: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);
            } else if (tx?.payment_url) {
              return NextResponse.json({ success: true, payment_url: tx.payment_url });
            }
          }
        } catch {
          // Fall through to create new transaction
        }
      }
    }

    if (payment.payment_url && !payment.transaction_reference) {
      return NextResponse.json({ success: true, payment_url: payment.payment_url });
    }

    const config = getPaymentConfig();

    if (config.provider === 'cinetpay') {
      if (payment.payment_url && payment.transaction_reference) {
        return NextResponse.json({ success: true, payment_url: payment.payment_url });
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      // ID DÉTERMINISTE : si l'écriture précédente a échoué après la création
      // côté CinetPay, un retry réutilise LE MÊME transactionId au lieu d'en
      // créer une nouvelle transaction orpheline.
      const transactionId = payment.transaction_reference || `ATEMI-${order.order_number}`;
      try {
        // 1. Persister d'abord les métadonnées fournisseur (atomique).
        const { error: metaError } = await supabase
          .from('payments')
          .update({
            provider: 'cinetpay',
            transaction_reference: transactionId,
            provider_transaction_id: transactionId,
            country: country?.toUpperCase() || null,
            payment_method: payment_method || 'cinetpay',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
        if (metaError) throw new Error('Enregistrement du paiement impossible');

        // 2. Création de la transaction côté CinetPay.
        const result = await createCinetPayPayment({
          transactionId,
          amount: payment.amount,
          description: `Acompte commande ${order.order_number}`,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          customerEmail: order.customer_email || `${order.order_number}@atemi.local`,
          notifyUrl: `${appUrl}/api/payment/webhook`,
          returnUrl: `${appUrl}/paiement?order=${encodeURIComponent(order.order_number)}&token=${tracking_token}&return=1`,
          config: {
            apiKey: config.apiKey,
            secretKey: config.apiSecret,
            siteId: config.siteId,
          },
        });

        // 3. Enregistrer l'URL de paiement retournée par CinetPay.
        const { error: urlError } = await supabase
          .from('payments')
          .update({
            transaction_reference: result.transactionId,
            provider_transaction_id: result.transactionId,
            payment_url: result.paymentUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
        if (urlError) throw new Error('Enregistrement du paiement impossible');
        console.info('[PAYMENT_CREATED]', {
          provider: 'cinetpay',
          orderNumber: order.order_number,
          transactionReference: result.transactionId,
        });
        return NextResponse.json({ success: true, payment_url: result.paymentUrl });
      } catch (error) {
        console.error('[PAYMENT_CREATION_FAILED]', {
          provider: 'cinetpay',
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ success: false, error: 'Erreur lors de la creation du paiement CinetPay' }, { status: 502 });
      }
    }

    if (config.provider !== 'fedapay') {
      return NextResponse.json(
        { success: false, error: 'Aucun fournisseur de paiement reel configure' },
        { status: 501 }
      );
    }

    const baseUrl = getFedaPayBaseUrl(config.apiSecret);
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const appUrl = process.env.NODE_ENV === 'production'
      ? configuredAppUrl
      : request.nextUrl.origin;
    if (!appUrl) {
      return NextResponse.json(
        { success: false, error: 'URL publique de retour non configurée' },
        { status: 500 }
      );
    }

    const nameParts = (order.customer_name || '').trim().split(' ');
    const firstname = nameParts[0] || 'Client';
    const lastname = nameParts.slice(1).join(' ') || 'Atemi';
    // Fallback pour les invites sans email  a verifier avec FedaPay en sandbox
    const email = order.customer_email || `${order.order_number}@atemi.local`;
    const rawPhone = String(order.customer_phone || '').replace(/\D/g, '');
    let phone = rawPhone.startsWith('229') ? rawPhone.slice(3) : rawPhone;
    // Benin numbers can be entered as 01XXXXXXXX (new format), 0XXXXXXXX,
    // or as the international 229XXXXXXXX form. FedaPay expects 8 digits.
    if (phone.startsWith('01') && phone.length === 10) {
      phone = phone.slice(2);
    } else if (phone.startsWith('0') && phone.length === 9) {
      phone = phone.slice(1);
    }

    if (phone.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'Numero de telephone invalide pour le paiement Mobile Money' },
        { status: 400 }
      );
    }

    let fedaResponse: Response;
    try {
      fedaResponse = await fetch(`${baseUrl}/v1/transactions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `Acompte commande ${order.order_number}`,
          amount: payment.amount,
          currency: { iso: 'XOF' },
          callback_url: `${appUrl}/paiement?order=${encodeURIComponent(order.order_number)}&token=${tracking_token}&return=1`,
          customer: {
            firstname,
            lastname,
            email,
            phone_number: { number: phone, country: 'bj' },
          },
        }),
      });
    } catch {
      return NextResponse.json({ success: false, error: 'Impossible de contacter le fournisseur de paiement' }, { status: 502 });
    }

    if (!fedaResponse.ok) {
      return NextResponse.json({ success: false, error: 'Erreur lors de la creation du paiement' }, { status: 502 });
    }

    const fedaData = await fedaResponse.json();
    const transaction = fedaData['v1/transaction'];

    if (!transaction?.reference || !transaction?.payment_url) {
      return NextResponse.json({ success: false, error: 'Reponse invalide du fournisseur de paiement' }, { status: 502 });
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        transaction_reference: transaction.reference,
        payment_url: transaction.payment_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: "Erreur lors de l'enregistrement du paiement" }, { status: 500 });
    }

    return NextResponse.json({ success: true, payment_url: transaction.payment_url });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Methode non autorisee' }, { status: 405 });
}