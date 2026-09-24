import type { PaymentProvider, PaymentConfirmation, WebhookVerificationResult } from '../types';

interface CinetPayConfig {
  apiKey: string;
  secretKey: string;
  siteId: string;
}

interface CinetPayResponse {
  code?: string;
  message?: string;
  data?: {
    payment_url?: string;
    transaction_id?: string;
    amount?: number | string;
    currency?: string;
    status?: string;
    payment_method?: string;
  };
}

const CINETPAY_API = 'https://api-checkout.cinetpay.com/v2';
const CINETPAY_TIMEOUT_MS = 15_000;

function createTimeoutSignal(ms: number): AbortSignal {
  // Node 18+ provides AbortSignal.timeout, but test environments (jsdom / older Node) may not.
  // Provide a small fallback that creates an AbortController and aborts after the timeout.
  // Keep this function local to avoid adding extra dependencies.
  const timeout = (AbortSignal as typeof AbortSignal & {
    timeout?: (timeout: number) => AbortSignal;
  }).timeout;
  if (timeout) {
    return timeout(ms);
  }
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  // Clear the timeout if the signal aborts earlier
  ac.signal.addEventListener('abort', () => clearTimeout(id));
  return ac.signal;
}


/**
 * CinetPay adapter. CinetPay notifications are intentionally not trusted:
 * the transaction is checked against the provider API before confirmation.
 */
export class CinetPayPaymentProvider implements PaymentProvider {
  readonly name = 'cinetpay';

  constructor(private readonly config: CinetPayConfig) {}

  async verifyWebhook(
    payload: string,
    _signature?: string | null,
    _timestamp?: string | null
  ): Promise<WebhookVerificationResult> {
    try {
      const data = parseCinetPayPayload(payload);
      const transactionId = data.cpm_trans_id || data.transaction_id;
      if (!transactionId || typeof transactionId !== 'string') {
        return { valid: false, event: null, error: 'Référence CinetPay manquante' };
      }
      return { valid: true, event: null };
    } catch {
      return { valid: false, event: null, error: 'Notification CinetPay invalide' };
    }
  }

  async getPaymentStatus(providerTransactionId: string): Promise<PaymentConfirmation> {
    const response = await fetch(`${CINETPAY_API}/payment/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: createTimeoutSignal(CINETPAY_TIMEOUT_MS),
      body: JSON.stringify({
        apikey: this.config.apiKey,
        site_id: this.config.siteId,
        transaction_id: providerTransactionId,
      }),
    });
    if (!response.ok) {
      throw new Error(`CinetPay verification failed with HTTP ${response.status}`);
    }
    const result = await response.json() as CinetPayResponse;
    const data = result.data;
    const status = String(data?.status || (result.code === '00' ? 'ACCEPTED' : '')).toUpperCase();
    return {
      providerTransactionId,
      amount: Number(data?.amount || 0),
      currency: String(data?.currency || 'XOF').toUpperCase(),
      status: ['ACCEPTED', 'SUCCESS'].includes(status)
        ? 'succeeded'
        : ['REFUSED', 'CANCELLED', 'FAILED'].includes(status) ? 'failed' : 'pending',
      paidAt: ['ACCEPTED', 'SUCCESS'].includes(status) ? new Date().toISOString() : null,
      metadata: { paymentMethod: data?.payment_method },
    };
  }

  async isEventProcessed(): Promise<boolean> {
    return false;
  }

  async markEventProcessed(): Promise<void> {
    // Persistent idempotence is handled by the shared idempotency table.
  }
}

function parseCinetPayPayload(payload: string): Record<string, unknown> {
  if (payload.trimStart().startsWith('{')) {
    return JSON.parse(payload) as Record<string, unknown>;
  }
  const params = new URLSearchParams(payload);
  return Object.fromEntries(params.entries());
}

export async function createCinetPayPayment(input: {
  transactionId: string;
  amount: number;
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notifyUrl: string;
  returnUrl: string;
  config: CinetPayConfig;
}): Promise<{ paymentUrl: string; transactionId: string }> {
  const response = await fetch(`${CINETPAY_API}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: createTimeoutSignal(CINETPAY_TIMEOUT_MS),
    body: JSON.stringify({
      apikey: input.config.apiKey,
      site_id: input.config.siteId,
      transaction_id: input.transactionId,
      amount: input.amount,
      currency: 'XOF',
      description: input.description,
      notify_url: input.notifyUrl,
      return_url: input.returnUrl,
      channels: 'ALL',
      customer_name: input.customerName,
      customer_phone_number: input.customerPhone,
      customer_email: input.customerEmail,
    }),
  });
  if (!response.ok) throw new Error(`CinetPay initiation failed with HTTP ${response.status}`);
  const result = await response.json() as CinetPayResponse;
  if (!result.data?.payment_url || !result.data.transaction_id) {
    throw new Error(result.message || 'Réponse CinetPay invalide');
  }
  return { paymentUrl: result.data.payment_url, transactionId: result.data.transaction_id };
}
