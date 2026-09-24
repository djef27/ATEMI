/**
 * Payment provider interface  abstraction layer for future providers.
 *
 * When a real provider is configured (Stripe, Paystack, FedaPay, etc.),
 * implement this interface in a concrete adapter.
 */

export interface PaymentProviderConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
}

export interface PaymentConfirmation {
  providerTransactionId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  paidAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  event: WebhookEvent | null;
  error?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  created: number;
  livemode: boolean;
}

export interface PaymentProvider {
  readonly name: string;

  /** Verify webhook signature and parse event */
  verifyWebhook(
    payload: string,
    signature: string | null,
    timestamp: string | null
  ): Promise<WebhookVerificationResult>;

  /** Retrieve payment status from provider */
  getPaymentStatus(
    providerTransactionId: string
  ): Promise<PaymentConfirmation>;

  /** Check for replay: has this event ID been processed? */
  isEventProcessed(eventId: string): Promise<boolean>;

  /** Mark event as processed */
  markEventProcessed(eventId: string): Promise<void>;
}

/**
 * Map provider event types to our internal actions.
 * Each provider has different event naming  this normalizes them.
 */
export const PROVIDER_EVENT_MAP: Record<string, string> = {
  // Stripe-style events
  'payment_intent.succeeded': 'payment_confirmed',
  'payment_intent.payment_failed': 'payment_failed',
  'payment_intent.refunded': 'payment_refunded',

  // Paystack-style events
  'charge.success': 'payment_confirmed',
  'charge.failed': 'payment_failed',
  'charge.refunded': 'payment_refunded',

  // FedaPay-style events
  'transaction.approved': 'payment_confirmed',
  'transaction.declined': 'payment_failed',
  'transaction.canceled': 'payment_failed',

  // Generic fallback
  'payment.confirmed': 'payment_confirmed',
  'payment.failed': 'payment_failed',
  'payment.refunded': 'payment_refunded',
  // CinetPay notification normalized events
  'cinetpay.payment.success': 'payment_confirmed',
};