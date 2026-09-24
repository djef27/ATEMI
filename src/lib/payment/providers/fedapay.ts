/**
 * FedaPayPaymentProvider — concrete adapter for FedaPay.
 *
 * FedaPay is a payment aggregator supporting Mobile Money (Moov, MTN)
 * and bank transfers in Benin and West Africa.
 *
 * API documentation: https://docs.fedapay.com/
 *
 * IMPORTANT: This provider requires:
 * - PAYMENT_API_KEY (public key from FedaPay dashboard)
 * - PAYMENT_API_SECRET (secret key from FedaPay dashboard)
 * - PAYMENT_WEBHOOK_SECRET (webhook signing key from FedaPay dashboard)
 *
 * WEBHOOK EVENTS:
 * - transaction.approved → payment confirmed
 * - transaction.declined → payment failed
 * - transaction.canceled → payment failed
 *
 * AMOUNT FORMAT: FedaPay uses XOF with div:1 (no cents).
 * CURRENCY: comes as currency_id (numeric), 1 = XOF on this account.
 *
 * SIGNATURE: FedaPay sends signature in x-fedapay-signature header.
 * Format: "t=<timestamp>,s=<signature>"
 * Uses WebhookSignature.verifyHeader() from the fedapay package.
 */

import type { PaymentProvider, PaymentConfirmation, WebhookVerificationResult } from '../types';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

interface FedaPayConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

export class FedaPayPaymentProvider implements PaymentProvider {
  readonly name = 'fedapay';

  private config: FedaPayConfig;

  constructor(config: FedaPayConfig) {
    this.config = config;
  }

  async verifyWebhook(
    payload: string,
    signature: string | null,
    _timestamp: string | null
  ): Promise<WebhookVerificationResult> {
    if (!signature) {
      return { valid: false, event: null, error: 'Signature manquante' };
    }

    try {
      // Dynamic import to avoid build issues if fedapay is not installed
      const { WebhookSignature } = await import('fedapay');

      // FedaPay's own library verifies signature AND embedded timestamp
      // Header format: "t=<timestamp>,s=<signature>"
      // Throws on failure
      WebhookSignature.verifyHeader(payload, signature, this.config.webhookSecret, 300);

      return { valid: true, event: null };
    } catch (error) {
      return {
        valid: false,
        event: null,
        error: error instanceof Error ? error.message : 'Signature verification failed',
      };
    }
  }

  async getPaymentStatus(
    providerTransactionId: string
  ): Promise<PaymentConfirmation> {
    // Retrieve payment status from DB (webhook already verified the transaction)
    const supabase = createAdminSupabaseClient();

    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, amount, currency, status, paid_at')
      .eq('transaction_reference', providerTransactionId)
      .single();

    if (error || !payment) {
      return {
        providerTransactionId,
        amount: 0,
        currency: 'XOF',
        status: 'pending',
        paidAt: null,
      };
    }

    return {
      providerTransactionId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status === 'paid' ? 'succeeded' : payment.status === 'failed' ? 'failed' : 'pending',
      paidAt: payment.paid_at,
    };
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    const supabase = createAdminSupabaseClient();

    const { data } = await supabase
      .from('idempotency_keys')
      .select('id')
      .eq('idempotency_key', `fedapay:evt:${eventId}`)
      .single();

    return !!data;
  }

  async markEventProcessed(eventId: string): Promise<void> {
    const supabase = createAdminSupabaseClient();

    await supabase.rpc('store_idempotency_response', {
      p_key: `fedapay:evt:${eventId}`,
      p_response_status: 200,
      p_response_body: { processed: true, provider: 'fedapay' },
    });
  }

  /**
   * Parse FedaPay webhook event into normalized shape.
   *
   * FedaPay payload shape:
   * {
   *   id: "evt_xxx",
   *   type: "transaction.approved",
   *   entity: "<JSON string of transaction>",
   *   object_id: 123,
   *   account_id: 456,
   *   object: "event"
   * }
   *
   * The `entity` field must be JSON.parse()'d a second time.
   */
  static parseEvent(body: string): { id: string; type: string; data: Record<string, unknown> } | null {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(body);
    } catch {
      return null;
    }

    if (!raw.id || !raw.type || typeof raw.entity !== 'string') return null;

    let entity: Record<string, unknown>;
    try {
      entity = JSON.parse(raw.entity);
    } catch {
      return null;
    }

    return {
      id: String(raw.id),
      type: String(raw.type),
      data: entity,
    };
  }

  /**
   * Extract amount and currency from FedaPay event data.
   * FedaPay uses div:1 for XOF (no cents), currency_id 1 = XOF.
   */
  static extractAmountCurrency(data: Record<string, unknown>): { amount: number | null; currency: string | null } {
    const amount = typeof data.amount === 'number' ? data.amount : null;
    const currencyId = data.currency_id;
    const currency = currencyId === 1 ? 'XOF' : null;
    return { amount, currency };
  }
}
