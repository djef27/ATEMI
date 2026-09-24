/**
 * Webhook event decoding helpers — unit tests.
 *
 * Covers parsing (JSON / form-encoded / FedaPay envelope), transaction id
 * extraction, and amount/currency decoding rules per provider. These rules
 * feed the "amount divergent", "devise divergente" and "en attente" guards
 * in the webhook route.
 */

import {
  parseEvent,
  extractTransactionId,
  extractAmountCurrency,
  extractPaymentMethod,
  shouldDeferConfirmation,
} from '@/lib/payment/webhook-events';

describe('parseEvent', () => {
  it('parses a CinetPay JSON success notification', () => {
    const event = parseEvent(
      JSON.stringify({ cpm_trans_id: 'ATEMI-100', cpm_result: '00', cpm_amount: 2500 }),
      'cinetpay'
    );
    expect(event).toMatchObject({ id: 'ATEMI-100', type: 'payment.confirmed' });
  });

  it('parses a CinetPay form-encoded success notification', () => {
    const event = parseEvent('cpm_trans_id=ATEMI-200&cpm_result=00', 'cinetpay');
    expect(event).toMatchObject({ id: 'ATEMI-200', type: 'payment.confirmed' });
  });

  it('maps a refused / failed CinetPay result to payment.failed', () => {
    const event = parseEvent(
      JSON.stringify({ transaction_id: 'ATEMI-300', cpm_result: 'REFUSED' }),
      'cinetpay'
    );
    expect(event).toMatchObject({ id: 'ATEMI-300', type: 'payment.failed' });
    expect(event?.data).not.toBeNull();
  });

  it('rejects CinetPay notifications without a transaction reference', () => {
    expect(parseEvent(JSON.stringify({ cpm_result: '00' }), 'cinetpay')).toBeNull();
    expect(parseEvent('not-json', 'cinetpay')).toBeNull();
  });

  it('parses a FedaPay envelope and unwraps its entity', () => {
    const event = parseEvent(
      JSON.stringify({
        id: 'evt_1',
        type: 'transaction.created',
        entity: JSON.stringify({ reference: 'FDP-1', amount: 5000, currency_id: 1 }),
      }),
      'fedapay'
    );
    expect(event).toMatchObject({ id: 'evt_1', type: 'transaction.created', data: { reference: 'FDP-1' } });
  });

  it('rejects a FedaPay envelope with non-JSON entity', () => {
    expect(
      parseEvent(JSON.stringify({ id: 'evt_1', type: 'x', entity: 'not-json' }), 'fedapay')
    ).toBeNull();
  });

  it('parses a generic Stripe/Paystack envelope (data.object)', () => {
    const event = parseEvent(
      JSON.stringify({ id: 'evt_9', type: 'charge.succeeded', data: { object: { id: 'ch_1', amount: 500 } } }),
      'stripe'
    );
    expect(event).toMatchObject({ id: 'evt_9', type: 'charge.succeeded', data: { id: 'ch_1' } });
    expect(parseEvent(JSON.stringify({ id: 'evt_x', type: 'no-data' }), 'stripe')).toBeNull();
  });
});

describe('extractTransactionId', () => {
  it('falls back to the provider transaction id for CinetPay', () => {
    expect(extractTransactionId({ cpm_trans_id: 'CP-1' }, 'cinetpay')).toBe('CP-1');
    expect(extractTransactionId({ transaction_id: 'CP-2' }, 'cinetpay')).toBe('CP-2');
    expect(extractTransactionId({}, 'cinetpay')).toBeNull();
  });

  it('falls back to entity id for FedaPay', () => {
    expect(extractTransactionId({ reference: 'FDP-1' }, 'fedapay')).toBe('FDP-1');
    expect(extractTransactionId({ id: 'FDP-2' }, 'fedapay')).toBe('FDP-2');
  });
});

describe('extractAmountCurrency', () => {
  it('keeps FedaPay XOF amounts as-is (no division)', () => {
    expect(extractAmountCurrency({ amount: 5000, currency_id: 1 }, 'fedapay')).toEqual({
      amount: 5000,
      currency: 'XOF',
    });
    expect(extractAmountCurrency({ amount: 5000, currency_id: 99 }, 'fedapay')).toEqual({
      amount: 5000,
      currency: null,
    });
  });

  it('divides Stripe/Paystack minor units by 100', () => {
    expect(extractAmountCurrency({ amount: 250000, currency: 'xof' }, 'stripe')).toEqual({
      amount: 2500,
      currency: 'XOF',
    });
    expect(extractAmountCurrency({ amount: 250000, currency: 'ngn' }, 'paystack')).toEqual({
      amount: 2500,
      currency: 'NGN',
    });
  });

  it('reads CinetPay amounts/currency from the notification fields', () => {
    expect(extractAmountCurrency({ cpm_amount: '7500', cpm_currency: 'XOF' }, 'cinetpay')).toEqual({
      amount: 7500,
      currency: 'XOF',
    });
    expect(extractAmountCurrency({ cpm_amount: 'abc' }, 'cinetpay')).toEqual({
      amount: null,
      currency: 'XOF',
    });
  });

  it('returns nulls for an unknown provider', () => {
    expect(extractAmountCurrency({ amount: 100 }, 'unknown')).toEqual({ amount: null, currency: null });
  });
});

describe('extractPaymentMethod', () => {
  it('reads CinetPay and FedaPay method fields with a fallback', () => {
    expect(extractPaymentMethod({ cpm_payment_method: 'MTN_MONEY' }, 'cinetpay')).toBe('MTN_MONEY');
    expect(extractPaymentMethod({ mode: 'cmr' }, 'fedapay')).toBe('cmr');
    expect(extractPaymentMethod({}, 'cinetpay')).toBe('cinetpay');
  });
});

describe('shouldDeferConfirmation', () => {
  it('defers a CinetPay transaction that is not confirmed yet', () => {
    expect(shouldDeferConfirmation({ status: 'pending' })).toBe(true);
    expect(shouldDeferConfirmation({ status: 'failed' })).toBe(true);
  });

  it('confirms immediately when the provider check reports succeeded', () => {
    expect(shouldDeferConfirmation({ status: 'succeeded' })).toBe(false);
  });

  it('does not defer providers without a server-side check (FedaPay signed event)', () => {
    expect(shouldDeferConfirmation(null)).toBe(false);
  });
});