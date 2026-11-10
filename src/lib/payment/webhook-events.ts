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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseEvent(
  body: string,
  provider: string
): ParsedWebhookEvent | null {
  let raw: unknown;
  try {
    if (provider === 'cinetpay' && !body.trimStart().startsWith('{')) {
      raw = Object.fromEntries(new URLSearchParams(body).entries());
    } else {
      raw = JSON.parse(body);
    }
  } catch {
    return null;
  }

  if (!isRecord(raw)) return null;

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
    if (!raw.id || !raw.type) return null;
    let entity: unknown = raw.entity;
    if (typeof entity === 'string') {
      try {
        entity = JSON.parse(entity);
      } catch {
        return null;
      }
    }
    if (!isRecord(entity)) return null;
    return { id: String(raw.id), type: String(raw.type), data: entity };
  }

  if (provider === 'saspay') {
    // SasPay: { event: "transaction.success", data: { id, reference, ... } }
    if (!raw.event || !isRecord(raw.data)) return null;
    const eventData = raw.data;
    const transactionId = eventData.reference || eventData.id;
    if (!transactionId) return null;
    return { id: String(transactionId), type: String(raw.event), data: eventData };
  }

  // Stripe / Paystack: { id, type, data: { object: {...} } }
  const data = isRecord(raw.data) ? raw.data : null;
  const object = data && isRecord(data.object) ? data.object : null;
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

  if (provider === 'saspay') {
    return (data.reference as string) || (data.id as string) || null;
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

  if (provider === 'saspay') {
    // SasPay amounts are strings in decimal format ("5000.00")
    const amount = typeof data.amount === 'string'
      ? parseFloat(data.amount)
      : typeof data.amount === 'number'
        ? data.amount
        : null;
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : 'XOF';
    return { amount: amount === 0 ? null : amount, currency: amount === null ? null : currency };
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
  if (provider === 'saspay') {
    return (data.network as string) || (data.type as string) || 'saspay';
  }
  return (data.channel as string) || (data.mode as string) || 'webhook';
}