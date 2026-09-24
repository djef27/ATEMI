/**
 * MockPaymentProvider — for development and automated tests only.
 *
 * NEVER use in production. This provider:
 * - Accepts all webhooks as valid
 * - Returns mock payment statuses
 * - Does not perform real financial transactions
 */

import type { PaymentProvider, PaymentConfirmation, WebhookVerificationResult, WebhookEvent } from '../types';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  private processedEvents = new Set<string>();

  async verifyWebhook(
    _payload: string,
    _signature: string | null,
    _timestamp: string | null
  ): Promise<WebhookVerificationResult> {
    // Mock: always accept
    return { valid: true, event: null };
  }

  async getPaymentStatus(
    _providerTransactionId: string
  ): Promise<PaymentConfirmation> {
    // Mock: always return succeeded
    return {
      providerTransactionId: _providerTransactionId,
      amount: 0,
      currency: 'XOF',
      status: 'succeeded',
      paidAt: new Date().toISOString(),
    };
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async markEventProcessed(eventId: string): Promise<void> {
    this.processedEvents.add(eventId);
  }

  /** Reset state (for tests) */
  reset(): void {
    this.processedEvents.clear();
  }
}
