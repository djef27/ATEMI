/**
 * Pure helpers for provider webhook event decoding.
 *
 * Extracted from the webhook route so parsing / amount / currency rules are
 * unit-testable without spinning up a route. No behavior change.
 */

export interface ParsedWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export function parseEvent(
  body: string,
  provider: string
): ParsedWebhookEvent | null {
  let raw: Record<string, unknown>;
  try {
    if (provider === 'cinetpay' && !body.trimStart().startsWith('{')) {
      raw = Object.fromEntries(new URLSearchParams(body).entries());
    } else {
      raw = JSON.parse(body);
    }
  } catch {
    return null;
  }

  if (provider === 'cinetpay') {
    const transactionId = raw.cpm_trans_id || raw.transaction_id;
    if (!transactionId) return null;
    const result = String(raw.cpm_result || '').toUpperCase();
    return {
      id: String(transactionId),
      type: ['00', 'ACCEPTED', 'SUCCESS'].includes(result)
        ? 'payment.confirmed'
        : 'payment.failed',
      data: raw,
    };
  }

  if (provider === 'fedapay') {
    // FedaPay: { id, type, entity: "<JSON string>", ... }
    if (!raw.id || !raw.type || typeof raw.entity !== 'string') return null;
    let entity: Record<string, unknown>;
    try {
      entity = JSON.parse(raw.entity);
    } catch {
      return null;
    }
    return { id: String(raw.id), type: String(raw.type), data: entity };
  }

  // Stripe / Paystack: { id, type, data: { object: {...} } }
  const data = raw.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;
  if (!raw.id || !raw.type || !object) return null;
  return { id: String(raw.id), type: String(raw.type), data: object };
}

export function extractTransactionId(data: Record<string, unknown>, provider: string): string | null {
  if (provider === 'fedapay') {
    return (data.reference as string) || (data.id as string) || null;
  }

  if (provider === 'cinetpay') {
    return (data.cpm_trans_id as string) || (data.transaction_id as string) || null;
  }
  // Stripe / Paystack
  return (data.reference as string) ||
         (data.id as string) ||
         (data.payment_intent as string) ||
         (data.transaction_id as string) ||
         null;
}

export function extractAmountCurrency(
  data: Record<string, unknown>,
  provider: string
): { amount: number | null; currency: string | null } {
  if (provider === 'fedapay') {
    // Confirmed via sandbox: amount is NOT divided (div:1 for XOF).
    // currency_id 1 = XOF on this account.
    const amount = typeof data.amount === 'number' ? data.amount : null;
    const currencyId = data.currency_id;
    const currency = currencyId === 1 ? 'XOF' : null;
    return { amount, currency };
  }

  if (provider === 'stripe' || provider === 'paystack') {
    // Stripe/Paystack use cents/kobo
    const rawAmount = typeof data.amount === 'number' ? data.amount : null;
    const amount = rawAmount !== null ? rawAmount / 100 : null;
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : null;
    return { amount, currency };
  }

  if (provider === 'cinetpay') {
    const amount = Number(data.cpm_amount);
    return {
      amount: Number.isFinite(amount) ? amount : null,
      currency: typeof data.cpm_currency === 'string' ? data.cpm_currency.toUpperCase() : 'XOF',
    };
  }

  return { amount: null, currency: null };
}

export function shouldDeferConfirmation(
  providerConfirmation: { status: string } | null
): boolean {
  return providerConfirmation !== null && providerConfirmation.status !== 'succeeded';
}

export function extractPaymentMethod(data: Record<string, unknown>, provider: string): string {
  if (provider === 'fedapay') {
    return (data.mode as string) || (data.channel as string) || 'webhook';
  }
  if (provider === 'cinetpay') {
    return (data.cpm_payment_method as string) || (data.payment_method as string) || 'cinetpay';
  }
  return (data.channel as string) || (data.mode as string) || 'webhook';
}