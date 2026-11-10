/**
 * SasPayPaymentProvider — concrete adapter for SasPay.
 *
 * SasPay is a payment gateway for West and Central Africa (mobile money, card).
 * Official docs: https://docs.saspay.me/
 *
 * KEY DIFFERENCES FROM OTHER PROVIDERS:
 * - Single secret key passed as `Authorization: Bearer sk_test_...` (NOT apiKey+secret)
 * - Checkout flow uses hosted page (checkout_url), not payment_url
 * - Webhooks use HMAC-SHA256 signature over "timestamp.body"
 *
 * ENV VARS:
 *   SASPay_API_KEY      : Bearer token (sk_test_... / sk_live_...)
 *   SASPay_WEBHOOK_SECRET : Secret used to verify webhook signatures
 *   SASPay_BASE_URL     : Default https://api.saspay.me/api/v1
 *   SASPay_ENVIRONMENT  : sandbox | live
 */

import type {
  PaymentProvider,
  PaymentConfirmation,
  WebhookVerificationResult,
  WebhookEvent,
} from '../types';
import { createHmac, timingSafeEqual } from 'crypto';

export interface SasPayConfig {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  environment: 'sandbox' | 'live';
}

interface SasPayCheckoutSessionResponse {
  id: string;
  checkout_url: string;
  amount: string;
  currency: string;
  description: string;
  country: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  return_url: string;
  metadata: Record<string, unknown>;
  fee_charge_mode: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SasPayVerifyResponse {
  success: boolean;
  data: {
    id: string;
    reference: string;
    status: string;
    amount: string;
    currency: string;
    charged: string;
    net_amount: string;
    fee: string;
    fee_charge_mode: string;
    country: string;
    network: string;
    msisdn: string;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
  };
  code: number;
}

interface SasPayWebhookEvent {
  event: string; // e.g. "transaction.success"
  data: Record<string, unknown>;
}

const SASPAY_TIMEOUT_MS = 15_000;

function createTimeoutSignal(ms: number): AbortSignal {
  const timeout =
    (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal })
      .timeout;
  if (timeout) return timeout(ms);
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  ac.signal.addEventListener('abort', () => clearTimeout(id));
  return ac.signal;
}

function hmacSha256Hex(key: string, message: string): string {
  const sign = createHmac('sha256', key);
  sign.update(message, 'utf8');
  return sign.digest('hex');
}

export class SasPayPaymentProvider implements PaymentProvider {
  readonly name = 'saspay';

  constructor(private readonly config: SasPayConfig) {}

  /**
   * Verify SasPay webhook signature.
   *
   * SasPay sends:
   *   X-Webhook-Signature: <hex sha256 HMAC of timestamp.body>
   *   X-Webhook-Timestamp: <unix seconds>
   *   X-Webhook-Event: <event type>
   *
   * Signature = HMAC-SHA256(signing_secret, `${timestamp}.${body}`)
   * Compare in constant time.
   */
  async verifyWebhook(
    payload: string,
    signature: string | null,
    timestamp: string | null
  ): Promise<WebhookVerificationResult> {
    if (!signature) {
      return { valid: false, event: null, error: 'Signature manquante' };
    }
    if (!timestamp) {
      return { valid: false, event: null, error: 'Timestamp manquant' };
    }

    // Timestamp must be recent (< 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Math.abs(now - ts) > 300) {
      return { valid: false, event: null, error: 'Timestamp trop ancien' };
    }

    // Recompute signature over raw body
    let expectedSig: string;
    try {
      expectedSig = hmacSha256Hex(this.config.webhookSecret, `${timestamp}.${payload}`);
    } catch (error) {
      return {
        valid: false,
        event: null,
        error: 'Erreur signature locale',
      };
    }

    // Constant-time comparison
    const sigBytes = Buffer ? Buffer.from(signature) : null;
    const expectedBytes = Buffer.from(expectedSig);
    if (sigBytes && sigBytes.length !== expectedBytes.length) {
      return { valid: false, event: null, error: 'Longueur signature invalide' };
    }
    // Node.js Buffer comparison
    if (typeof Buffer !== 'undefined') {
      try {
        if (sigBytes) {
          if (!timingSafeEqual(sigBytes, expectedBytes)) {
            return { valid: false, event: null, error: 'Signature invalide' };
          }
        } else {
          // Fallback: case-insensitive string compare (won't be constant-time)
          if (signature.toLowerCase() !== expectedSig.toLowerCase()) {
            return { valid: false, event: null, error: 'Signature invalide' };
          }
        }
      } catch {
        // Fall through to string comparison
        if (signature.toLowerCase() !== expectedSig.toLowerCase()) {
          return { valid: false, event: null, error: 'Signature invalide' };
        }
      }
    } else {
      // Browser: plain comparison (no timing-safe available)
      if (signature.toLowerCase() !== expectedSig.toLowerCase()) {
        return { valid: false, event: null, error: 'Signature invalide' };
      }
    }

    return { valid: true, event: null };
  }

  /**
   * Create a hosted checkout session on SasPay.
   *
   * Returns the checkout_url the client is redirected to (NOT a payment_url).
   * SasPay does NOT support Idempotency-Key on checkout-sessions, so retries
   * may create duplicate sessions (harmless: they never charge until paid).
   */
  async createCheckoutSession(input: {
    amount: number;
    description: string;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    returnUrl?: string;
    country?: string;
    metadata?: Record<string, unknown>;
    feeChargeMode?: 'ADD_ON' | 'DEDUCTED';
  }): Promise<{ checkoutUrl: string; reference: string }> {
    if (!this.config.apiKey) {
      throw new Error('[SASPay] SASPay_API_KEY manquante');
    }

    const body: Record<string, unknown> = {
      amount: input.amount.toFixed(2),
      currency: 'XOF',
      description: input.description,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
    };

    if (input.customerPhone) {
      body.customer_phone = input.customerPhone;
    }
    if (input.returnUrl) {
      body.return_url = input.returnUrl;
    }
    if (input.country) {
      body.country = input.country;
    }
    if (input.metadata) {
      body.metadata = input.metadata;
    }
    if (input.feeChargeMode) {
      body.fee_charge_mode = input.feeChargeMode;
    }

    const response = await fetch(`${this.config.baseUrl}/checkout-sessions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal: createTimeoutSignal(SASPAY_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const bodyJson = (await response.json()) as { error?: { message?: string; code?: string } };
        if (bodyJson.error?.message) detail = bodyJson.error.message;
        if (bodyJson.error?.code) detail += ` [${bodyJson.error.code}]`;
      } catch {
        // Ignore body parse errors
      }
      throw new Error(`Erreur SasPay initiation: ${detail}`);
    }

    const result = (await response.json()) as SasPayCheckoutSessionResponse & {
      data?: Partial<SasPayCheckoutSessionResponse>;
    };
    const checkoutUrl = result.checkout_url || result.data?.checkout_url;
    const reference = result.id || result.data?.id || result.checkout_url?.split('/').pop() || result.data?.checkout_url?.split('/').pop();
    if (!checkoutUrl || !reference) {
      throw new Error('Réponse SasPay invalide (checkout_url ou id manquant)');
    }

    return { checkoutUrl, reference };
  }

  /**
   * Verify payment status against SasPay server (source of truth).
   *
   * Uses GET /payments/{payment_id}/verify/ with the reference as payment id.
   */
  async getPaymentStatus(
    providerTransactionId: string
  ): Promise<PaymentConfirmation> {
    if (!this.config.apiKey) {
      return {
        providerTransactionId,
        amount: 0,
        currency: 'XOF',
        status: 'pending',
        paidAt: null,
      };
    }

    // SasPay verify endpoint: GET /payments/{payment_id}/verify/
    const response = await fetch(
      `${this.config.baseUrl}/payments/${encodeURIComponent(providerTransactionId)}/verify/`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: createTimeoutSignal(SASPAY_TIMEOUT_MS),
      }
    );

    if (response.status === 404) {
      return {
        providerTransactionId,
        amount: 0,
        currency: 'XOF',
        status: 'pending',
        paidAt: null,
      };
    }

    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      console.error('[SASPay] verification failed:', body.error?.message || response.status);
      return {
        providerTransactionId,
        amount: 0,
        currency: 'XOF',
        status: 'pending',
        paidAt: null,
      };
    }

    const result = (await response.json()) as SasPayVerifyResponse;
    const data = result.data || {};

    const status = String(data.status || '').toUpperCase();
    const amount = Number(data.amount || 0);
    const currency = String(data.currency || 'XOF').toUpperCase();

    const paidAt =
      typeof data.paid_at === 'string' && data.paid_at
        ? data.paid_at
        : null;

    return {
      providerTransactionId,
      amount,
      currency,
      status: status === 'SUCCESS' ? 'succeeded' : status === 'FAILED' ? 'failed' : 'pending',
      paidAt,
      metadata: {
        network: data.network,
        fee: data.fee,
        charged: data.charged,
        net_amount: data.net_amount,
      },
    };
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    void eventId;
    return false;
  }

  async markEventProcessed(eventId: string): Promise<void> {
    void eventId;
  }

  /**
   * Parse a SasPay webhook event into normalized shape.
   *
   * SasPay event payload:
   *   { "event": "transaction.success", "data": { id, reference, ... } }
   */
  static parseWebhookEvent(body: string): SasPayWebhookEvent | null {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(body);
    } catch {
      return null;
    }
    if (!raw.event || !raw.data) return null;
    return {
      event: String(raw.event),
      data: raw.data as Record<string, unknown>,
    };
  }

  /**
   * Extract transaction reference and amount from a SasPay webhook event.
   */
  static extractTransactionReference(data: Record<string, unknown>): string | null {
    return (data.reference as string) || (data.id as string) || null;
  }

  /**
   * Extract amount and currency from a SasPay webhook event.
   * Amounts are strings in decimal format (e.g. "5000.00").
   */
  static extractAmountCurrency(
    data: Record<string, unknown>
  ): { amount: number | null; currency: string | null } {
    const amount = typeof data.amount === 'string'
      ? parseFloat(data.amount)
      : typeof data.amount === 'number'
        ? data.amount
        : null;
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : 'XOF';
    return { amount: amount === 0 ? null : amount, currency: amount === null ? null : currency };
  }

  /**
   * Extract payment method from a SasPay webhook event.
   */
  static extractPaymentMethod(data: Record<string, unknown>): string {
    return (data.network as string) || (data.type as string) || 'saspay';
  }
}
